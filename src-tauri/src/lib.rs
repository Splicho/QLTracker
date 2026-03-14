use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, UdpSocket};
use std::time::{Duration, Instant};

const STEAM_SERVER_LIST_URL: &str =
    "https://api.steampowered.com/IGameServersService/GetServerList/v1/";
const A2S_INFO_HEADER: &[u8] = b"\xFF\xFF\xFF\xFFTSource Engine Query\x00";
const A2S_PLAYER_HEADER: &[u8] = b"\xFF\xFF\xFF\xFFU\xFF\xFF\xFF\xFF";

#[derive(Debug, Deserialize)]
struct SteamListResponse {
    response: SteamServersPayload,
}

#[derive(Debug, Deserialize)]
struct SteamServersPayload {
    servers: Vec<SteamServerRecord>,
}

#[derive(Debug, Deserialize)]
struct SteamServerRecord {
    addr: String,
    #[serde(default)]
    steamid: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    map: Option<String>,
    #[serde(default, rename = "gamedir")]
    game_directory: Option<String>,
    #[serde(default, rename = "appid")]
    app_id: Option<u32>,
    #[serde(default)]
    players: Option<u8>,
    #[serde(default, rename = "max_players")]
    max_players: Option<u8>,
    #[serde(default)]
    bots: Option<u8>,
    #[serde(default)]
    region: Option<u8>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
struct ServerPlayer {
    name: String,
    score: i32,
    duration_seconds: f32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
struct QuakeServer {
    addr: String,
    steamid: Option<String>,
    name: String,
    map: String,
    game_directory: String,
    game_description: String,
    app_id: u32,
    players: u8,
    max_players: u8,
    bots: u8,
    ping_ms: Option<u128>,
    region: Option<u8>,
    version: Option<String>,
    keywords: Option<String>,
    connect_url: String,
    players_info: Vec<ServerPlayer>,
}

#[derive(Default)]
struct QueryInfo {
    name: Option<String>,
    map: Option<String>,
    game_directory: Option<String>,
    game_description: Option<String>,
    players: Option<u8>,
    max_players: Option<u8>,
    bots: Option<u8>,
    version: Option<String>,
    keywords: Option<String>,
    ping_ms: Option<u128>,
}

#[tauri::command]
async fn fetch_quake_live_servers(
    api_key: String,
    search: String,
    limit: u32,
) -> Result<Vec<QuakeServer>, String> {
    if api_key.trim().is_empty() {
        return Err("Steam API key is required.".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .get(STEAM_SERVER_LIST_URL)
        .query(&[
            ("key", api_key.as_str()),
            ("filter", search.as_str()),
            ("limit", &limit.to_string()),
        ])
        .send()
        .await
        .map_err(|error| format!("Steam API request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("Steam API returned HTTP {}.", response.status()));
    }

    let payload = response
        .json::<SteamListResponse>()
        .await
        .map_err(|error| format!("Steam API response was invalid: {error}"))?;

    let mut servers = Vec::with_capacity(payload.response.servers.len());

    for entry in payload.response.servers {
        let query_addr = normalize_addr(&entry.addr);
        let info = tauri::async_runtime::spawn_blocking(move || query_server(&query_addr))
            .await
            .map_err(|error| error.to_string())?
            .unwrap_or_default();

        servers.push(QuakeServer {
            addr: entry.addr.clone(),
            steamid: entry.steamid,
            name: info
                .name
                .or(entry.name)
                .unwrap_or_else(|| "Unknown server".into()),
            map: info.map.or(entry.map).unwrap_or_else(|| "unknown".into()),
            game_directory: info
                .game_directory
                .or(entry.game_directory)
                .unwrap_or_else(|| "quakelive".into()),
            game_description: info.game_description.unwrap_or_else(|| "Quake Live".into()),
            app_id: entry.app_id.unwrap_or(282_440),
            players: info.players.or(entry.players).unwrap_or(0),
            max_players: info.max_players.or(entry.max_players).unwrap_or(0),
            bots: info.bots.or(entry.bots).unwrap_or(0),
            ping_ms: info.ping_ms,
            region: entry.region,
            version: info.version,
            keywords: info.keywords,
            connect_url: format!("+connect {}", entry.addr),
            players_info: query_players(&normalize_addr(&entry.addr)).unwrap_or_default(),
        });
    }

    servers.sort_by(|left, right| {
        right
            .players
            .cmp(&left.players)
            .then_with(|| left.ping_ms.unwrap_or(u128::MAX).cmp(&right.ping_ms.unwrap_or(u128::MAX)))
    });

    Ok(servers)
}

fn normalize_addr(addr: &str) -> String {
    if addr.contains(':') {
        addr.to_string()
    } else {
        format!("{addr}:27015")
    }
}

fn query_server(addr: &str) -> Result<QueryInfo, String> {
    let socket_addr: SocketAddr = addr.parse().map_err(|error| format!("Bad address: {error}"))?;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|error| error.to_string())?;
    socket
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|error| error.to_string())?;

    let started = Instant::now();
    socket
        .send_to(A2S_INFO_HEADER, socket_addr)
        .map_err(|error| error.to_string())?;

    let mut buf = [0u8; 1400];
    let (size, _) = socket.recv_from(&mut buf).map_err(|error| error.to_string())?;
    let ping_ms = started.elapsed().as_millis();

    parse_info_response(&buf[..size], ping_ms)
}

fn parse_info_response(buf: &[u8], ping_ms: u128) -> Result<QueryInfo, String> {
    if buf.len() < 6 || buf[4] != 0x49 {
        return Err("Unexpected A2S_INFO response.".into());
    }

    let mut cursor = 6;
    let name = read_cstring(buf, &mut cursor)?;
    let map = read_cstring(buf, &mut cursor)?;
    let game_directory = read_cstring(buf, &mut cursor)?;
    let game_description = read_cstring(buf, &mut cursor)?;

    if cursor + 7 > buf.len() {
        return Err("Incomplete A2S_INFO payload.".into());
    }

    cursor += 2;
    let players = buf[cursor];
    cursor += 1;
    let max_players = buf[cursor];
    cursor += 1;
    let bots = buf[cursor];
    cursor += 1;
    cursor += 2;
    let version = read_cstring(buf, &mut cursor).ok();
    let keywords = if cursor < buf.len() {
        read_edf_keywords(buf, &mut cursor)
    } else {
        None
    };

    Ok(QueryInfo {
        name: Some(name),
        map: Some(map),
        game_directory: Some(game_directory),
        game_description: Some(game_description),
        players: Some(players),
        max_players: Some(max_players),
        bots: Some(bots),
        version,
        keywords,
        ping_ms: Some(ping_ms),
    })
}

fn read_edf_keywords(buf: &[u8], cursor: &mut usize) -> Option<String> {
    let edf = *buf.get(*cursor)?;
    *cursor += 1;
    if edf & 0x80 != 0 {
        *cursor += 2;
    }
    if edf & 0x10 != 0 {
        *cursor += 8;
    }
    if edf & 0x40 != 0 {
        *cursor += 2;
        *cursor += 8;
    }
    if edf & 0x20 != 0 {
        return read_cstring(buf, cursor).ok();
    }
    None
}

fn query_players(addr: &str) -> Result<Vec<ServerPlayer>, String> {
    let socket_addr: SocketAddr = addr.parse().map_err(|error| format!("Bad address: {error}"))?;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|error| error.to_string())?;
    socket
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|error| error.to_string())?;

    socket
        .send_to(A2S_PLAYER_HEADER, socket_addr)
        .map_err(|error| error.to_string())?;

    let mut challenge_buf = [0u8; 1400];
    let (size, _) = socket
        .recv_from(&mut challenge_buf)
        .map_err(|error| error.to_string())?;

    if size < 9 || challenge_buf[4] != 0x41 {
        return Ok(Vec::new());
    }

    let challenge = &challenge_buf[5..9];
    let mut request = vec![0xFF, 0xFF, 0xFF, 0xFF, 0x55];
    request.extend_from_slice(challenge);
    socket
        .send_to(&request, socket_addr)
        .map_err(|error| error.to_string())?;

    let (players_size, _) = socket
        .recv_from(&mut challenge_buf)
        .map_err(|error| error.to_string())?;

    parse_player_response(&challenge_buf[..players_size])
}

fn parse_player_response(buf: &[u8]) -> Result<Vec<ServerPlayer>, String> {
    if buf.len() < 6 || buf[4] != 0x44 {
        return Ok(Vec::new());
    }

    let mut cursor = 5;
    let player_count = buf[cursor] as usize;
    cursor += 1;
    let mut players = Vec::with_capacity(player_count);

    for _ in 0..player_count {
        if cursor >= buf.len() {
            break;
        }

        cursor += 1;
        let name = read_cstring(buf, &mut cursor)?;
        if cursor + 8 > buf.len() {
            break;
        }
        let score = i32::from_le_bytes(buf[cursor..cursor + 4].try_into().map_err(|_| "Invalid score payload.")?);
        cursor += 4;
        let duration_seconds =
            f32::from_le_bytes(buf[cursor..cursor + 4].try_into().map_err(|_| "Invalid duration payload.")?);
        cursor += 4;

        players.push(ServerPlayer {
            name,
            score,
            duration_seconds,
        });
    }

    Ok(players)
}

fn read_cstring(buf: &[u8], cursor: &mut usize) -> Result<String, String> {
    let start = *cursor;
    let end = buf[start..]
        .iter()
        .position(|byte| *byte == 0)
        .map(|offset| start + offset)
        .ok_or_else(|| "Missing string terminator.".to_string())?;

    *cursor = end + 1;
    Ok(String::from_utf8_lossy(&buf[start..end]).into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![fetch_quake_live_servers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
