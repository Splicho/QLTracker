use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io;
use std::net::{SocketAddr, UdpSocket};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::Manager;

const STEAM_SERVER_LIST_URL: &str =
    "https://api.steampowered.com/IGameServersService/GetServerList/v1/";
const A2S_PLAYER_HEADER: &[u8] = b"\xFF\xFF\xFF\xFFU\xFF\xFF\xFF\xFF";
const A2S_INFO_HEADER: &[u8] = b"\xFF\xFF\xFF\xFFTSource Engine Query\x00";
const CHECK_HOST_IP_INFO_URL: &str = "https://check-host.net/ip-info";
static COUNTRY_CACHE: OnceLock<Mutex<HashMap<String, Option<ServerCountryLocation>>>> =
    OnceLock::new();
static PING_CACHE: OnceLock<Mutex<HashMap<String, Option<u128>>>> = OnceLock::new();
static PASSWORD_CACHE: OnceLock<Mutex<HashMap<String, Option<bool>>>> = OnceLock::new();
static MODE_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
static PLAYER_RATING_CACHE: OnceLock<Mutex<HashMap<String, Vec<ServerPlayerRating>>>> =
    OnceLock::new();
static RATING_SUMMARY_CACHE: OnceLock<Mutex<HashMap<String, ServerRatingSummary>>> =
    OnceLock::new();

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
    region: Option<i32>,
    #[serde(default)]
    keywords: Option<String>,
    #[serde(default, rename = "gametype")]
    gametype: Option<String>,
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
struct ServerPlayerRating {
    name: String,
    steam_id: Option<String>,
    qelo: Option<f64>,
    trueskill: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
struct ServerRatingSummary {
    addr: String,
    average_qelo: Option<f64>,
    average_trueskill: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
struct ServerCountryLocation {
    addr: String,
    ip: String,
    country_name: Option<String>,
    country_code: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct A2sProbeResult {
    ping_ms: u128,
    requires_password: Option<bool>,
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
    region: Option<i32>,
    version: Option<String>,
    keywords: Option<String>,
    connect_url: String,
    players_info: Vec<ServerPlayer>,
}

fn normalize_addr(addr: &str) -> String {
    if addr.contains(':') {
        addr.to_string()
    } else {
        format!("{addr}:27960")
    }
}

fn extract_host(addr: &str) -> &str {
    addr.rsplit_once(':').map_or(addr, |(host, _)| host)
}

fn merge_server_keywords(keywords: Option<String>, gametype: Option<String>) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();

    for value in [keywords, gametype].into_iter().flatten() {
        for part in value.split(',') {
            let normalized = part.trim();
            if normalized.is_empty() {
                continue;
            }

            if !parts.iter().any(|existing| existing.eq_ignore_ascii_case(normalized)) {
                parts.push(normalized.to_string());
            }
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(","))
    }
}

fn country_cache() -> &'static Mutex<HashMap<String, Option<ServerCountryLocation>>> {
    COUNTRY_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn ping_cache() -> &'static Mutex<HashMap<String, Option<u128>>> {
    PING_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn password_cache() -> &'static Mutex<HashMap<String, Option<bool>>> {
    PASSWORD_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn mode_cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    MODE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn player_rating_cache() -> &'static Mutex<HashMap<String, Vec<ServerPlayerRating>>> {
    PLAYER_RATING_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn rating_summary_cache() -> &'static Mutex<HashMap<String, ServerRatingSummary>> {
    RATING_SUMMARY_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn extract_between<'a>(haystack: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let from = haystack.find(start)? + start.len();
    let tail = &haystack[from..];
    let to = tail.find(end)?;
    Some(&tail[..to])
}

fn parse_country_from_section(section: &str) -> Option<(String, String)> {
    let country_marker = section.find("<!-- Country -->")?;
    let country_section = &section[country_marker..];
    let country_name = extract_between(country_section, "<strong>", "</strong>")?
        .trim()
        .to_string();
    let country_code = extract_between(country_section, "(", ")")?.trim().to_lowercase();

    if country_name.is_empty() || country_code.len() != 2 {
        return None;
    }

    Some((country_name, country_code))
}

fn parse_country_from_html(addr: &str, ip: &str, html: &str) -> ServerCountryLocation {
    let providers = ["dbip", "ipgeolocation", "ip2location", "geolite2", "ipinfoio"];

    for provider in providers {
        let marker = format!("id=\"ip_info-{provider}\"");
        let Some(section_start) = html.find(&marker) else {
            continue;
        };

        let section = &html[section_start..];
        if let Some((country_name, country_code)) = parse_country_from_section(section) {
            return ServerCountryLocation {
                addr: addr.to_string(),
                ip: ip.to_string(),
                country_name: Some(country_name),
                country_code: Some(country_code),
            };
        }
    }

    ServerCountryLocation {
        addr: addr.to_string(),
        ip: ip.to_string(),
        country_name: None,
        country_code: None,
    }
}

async fn fetch_country_location(
    client: &reqwest::Client,
    addr: &str,
) -> Result<ServerCountryLocation, String> {
    let ip = extract_host(addr).to_string();

    if let Some(cached) = country_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&ip)
        .cloned()
    {
        return Ok(cached.unwrap_or(ServerCountryLocation {
            addr: addr.to_string(),
            ip,
            country_name: None,
            country_code: None,
        }));
    }

    let response = client
        .get(CHECK_HOST_IP_INFO_URL)
        .query(&[("host", ip.as_str())])
        .send()
        .await
        .map_err(|error| {
            let message = format!("Check-Host request failed for {ip}: {error}");
            let _ = country_cache()
                .lock()
                .map(|mut cache| cache.insert(ip.clone(), None));
            message
        })?;

    if !response.status().is_success() {
        country_cache()
            .lock()
            .map_err(|error| error.to_string())?
            .insert(ip.clone(), None);
        return Err(format!(
            "Check-Host returned HTTP {} for {}.",
            response.status(),
            ip
        ));
    }

    let html = response
        .text()
        .await
        .map_err(|error| {
            let message = format!("Check-Host response read failed for {ip}: {error}");
            let _ = country_cache()
                .lock()
                .map(|mut cache| cache.insert(ip.clone(), None));
            message
        })?;

    let location = parse_country_from_html(addr, &ip, &html);

    country_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(ip, Some(location.clone()));

    Ok(location)
}

fn read_cstring(buf: &[u8], cursor: &mut usize) -> Option<String> {
    if *cursor >= buf.len() {
        return None;
    }

    let start = *cursor;
    while *cursor < buf.len() && buf[*cursor] != 0 {
        *cursor += 1;
    }

    let value = String::from_utf8_lossy(&buf[start..(*cursor).min(buf.len())]).into_owned();

    if *cursor < buf.len() {
        *cursor += 1;
    }

    Some(value)
}

fn query_players(addr: &str) -> Result<Vec<ServerPlayer>, String> {
    let socket_addr: SocketAddr = normalize_addr(addr)
        .parse()
        .map_err(|error| format!("Invalid server address '{addr}': {error}"))?;

    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|error| error.to_string())?;
    socket
        .set_read_timeout(Some(Duration::from_secs(4)))
        .map_err(|error| error.to_string())?;
    socket
        .set_write_timeout(Some(Duration::from_secs(4)))
        .map_err(|error| error.to_string())?;

    socket
        .send_to(A2S_PLAYER_HEADER, socket_addr)
        .map_err(|error| format!("A2S challenge request failed: {error}"))?;

    let mut challenge_buf = [0_u8; 1400];
    let (challenge_len, _) = socket
        .recv_from(&mut challenge_buf)
        .map_err(|error| format!("A2S challenge response failed: {error}"))?;

    if challenge_len < 9 || &challenge_buf[0..5] != b"\xFF\xFF\xFF\xFFA" {
        return Err("Unexpected A2S challenge response.".into());
    }

    let challenge = &challenge_buf[5..9];
    let mut request = Vec::with_capacity(A2S_PLAYER_HEADER.len());
    request.extend_from_slice(&A2S_PLAYER_HEADER[..5]);
    request.extend_from_slice(challenge);

    socket
        .send_to(&request, socket_addr)
        .map_err(|error| format!("A2S player request failed: {error}"))?;

    let mut players_buf = [0_u8; 4096];
    let (players_len, _) = socket
        .recv_from(&mut players_buf)
        .map_err(|error| format!("A2S player response failed: {error}"))?;

    parse_player_response(&players_buf[..players_len])
}

fn parse_a2s_info_requires_password(buf: &[u8]) -> Result<bool, String> {
    if buf.len() < 6 || &buf[0..5] != b"\xFF\xFF\xFF\xFFI" {
        return Err("Unexpected A2S info response header.".into());
    }

    let mut cursor = 5;

    if cursor >= buf.len() {
        return Err("A2S info response was too short.".into());
    }

    cursor += 1; // protocol

    read_cstring(buf, &mut cursor).ok_or_else(|| "Missing A2S server name.".to_string())?;
    read_cstring(buf, &mut cursor).ok_or_else(|| "Missing A2S map name.".to_string())?;
    read_cstring(buf, &mut cursor).ok_or_else(|| "Missing A2S folder.".to_string())?;
    read_cstring(buf, &mut cursor).ok_or_else(|| "Missing A2S game name.".to_string())?;

    if cursor + 8 > buf.len() {
        return Err("A2S info response was too short to parse visibility.".into());
    }

    cursor += 2; // app id
    cursor += 1; // players
    cursor += 1; // max players
    cursor += 1; // bots
    cursor += 1; // server type
    cursor += 1; // environment

    Ok(buf[cursor] == 1)
}

fn cache_probe_result(
    normalized_addr: &str,
    ping_ms: Option<u128>,
    requires_password: Option<bool>,
) -> Result<(), String> {
    ping_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(normalized_addr.to_string(), ping_ms);
    password_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(normalized_addr.to_string(), requires_password);
    Ok(())
}

fn query_ping(addr: &str) -> Result<A2sProbeResult, String> {
    let normalized_addr = normalize_addr(addr);

    let cached_ping = ping_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&normalized_addr)
        .copied()
        .flatten();
    let cached_requires_password = password_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&normalized_addr)
        .copied()
        .flatten();

    if let (Some(ping_ms), Some(requires_password)) = (cached_ping, cached_requires_password) {
        return Ok(A2sProbeResult {
            ping_ms,
            requires_password: Some(requires_password),
        });
    }

    let socket_addr: SocketAddr = normalized_addr
        .parse()
        .map_err(|error| format!("Invalid server address '{addr}': {error}"))?;

    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|error| error.to_string())?;
    socket
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|error| error.to_string())?;
    socket
        .set_write_timeout(Some(Duration::from_secs(3)))
        .map_err(|error| error.to_string())?;

    let started_at = std::time::Instant::now();
    socket
        .send_to(A2S_INFO_HEADER, socket_addr)
        .map_err(|error| format!("A2S info request failed: {error}"))?;

    let mut response_buf = [0_u8; 1400];
    let (mut response_len, _) = socket
        .recv_from(&mut response_buf)
        .map_err(|error| format!("A2S info response failed: {error}"))?;

    if response_len >= 9 && &response_buf[0..5] == b"\xFF\xFF\xFF\xFFA" {
        let mut challenged_request = Vec::with_capacity(A2S_INFO_HEADER.len() + 4);
        challenged_request.extend_from_slice(A2S_INFO_HEADER);
        challenged_request.extend_from_slice(&response_buf[5..9]);

        socket
            .send_to(&challenged_request, socket_addr)
            .map_err(|error| format!("A2S challenged info request failed: {error}"))?;

        (response_len, _) = socket
            .recv_from(&mut response_buf)
            .map_err(|error| format!("A2S challenged info response failed: {error}"))?;
    }

    if response_len < 6 || &response_buf[0..5] != b"\xFF\xFF\xFF\xFFI" {
        let fallback_ping = query_system_ping(extract_host(&normalized_addr))?;
        cache_probe_result(&normalized_addr, Some(fallback_ping), None)?;
        return Ok(A2sProbeResult {
            ping_ms: fallback_ping,
            requires_password: None,
        });
    }

    let ping_ms = started_at.elapsed().as_millis();
    let requires_password = parse_a2s_info_requires_password(&response_buf[..response_len])?;
    cache_probe_result(&normalized_addr, Some(ping_ms), Some(requires_password))?;

    Ok(A2sProbeResult {
        ping_ms,
        requires_password: Some(requires_password),
    })
}

fn query_system_ping(host: &str) -> Result<u128, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("ping")
        .args(["-n", "1", "-w", "1200", host])
        .output()
        .map_err(|error| format!("System ping failed to start: {error}"))?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("ping")
        .args(["-c", "1", "-W", "1", host])
        .output()
        .map_err(|error| format!("System ping failed to start: {error}"))?;

    if !output.status.success() {
        return Err("System ping failed.".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[cfg(target_os = "windows")]
    {
        for part in stdout.split_whitespace() {
            if let Some(value) = part.strip_prefix("time=") {
                let ms = value.trim_end_matches("ms");
                if let Ok(parsed) = ms.parse::<u128>() {
                    return Ok(parsed);
                }
            }
            if let Some(value) = part.strip_prefix("time<") {
                if value.contains("ms") {
                    return Ok(1);
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        for part in stdout.split_whitespace() {
            if let Some(value) = part.strip_prefix("time=") {
                let ms = value.trim_end_matches("ms");
                if let Ok(parsed) = ms.parse::<f64>() {
                    return Ok(parsed.round() as u128);
                }
            }
        }
    }

    Err("Unable to parse system ping output.".into())
}

fn parse_player_response(buf: &[u8]) -> Result<Vec<ServerPlayer>, String> {
    if buf.len() < 6 {
        return Err("A2S player response was too short.".into());
    }

    if &buf[0..5] != b"\xFF\xFF\xFF\xFFD" {
        return Err("Unexpected A2S player response header.".into());
    }

    let player_count = usize::from(buf[5]);
    let mut cursor = 6;
    let mut players = Vec::with_capacity(player_count);

    for _ in 0..player_count {
        if cursor >= buf.len() {
            break;
        }

        cursor += 1;

        let name = read_cstring(buf, &mut cursor).unwrap_or_else(|| "Unknown player".into());

        if cursor + 8 > buf.len() {
            break;
        }

        let score = i32::from_le_bytes(
            buf[cursor..cursor + 4]
                .try_into()
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid score bytes"))
                .map_err(|error| error.to_string())?,
        );
        cursor += 4;

        let duration_seconds = f32::from_le_bytes(
            buf[cursor..cursor + 4]
                .try_into()
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid duration bytes"))
                .map_err(|error| error.to_string())?,
        );
        cursor += 4;

        players.push(ServerPlayer {
            name,
            score,
            duration_seconds,
        });
    }

    Ok(players)
}

#[tauri::command]
async fn fetch_quake_live_servers(
    api_key: String,
    search: String,
    limit: u32,
) -> Result<Vec<QuakeServer>, String> {
    log::info!(
        "fetch_quake_live_servers called with filter='{}' limit={}",
        search,
        limit
    );

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
        .map_err(|error| {
            let message = format!("Steam API response was invalid: {error}");
            log::error!("{message}");
            message
        })?;

    log::info!(
        "Steam returned {} raw server rows",
        payload.response.servers.len()
    );

    let mut servers = Vec::with_capacity(payload.response.servers.len());

    for entry in payload.response.servers {
        servers.push(QuakeServer {
            addr: entry.addr.clone(),
            steamid: entry.steamid,
            name: entry.name.unwrap_or_else(|| "Unknown server".into()),
            map: entry.map.unwrap_or_else(|| "unknown".into()),
            game_directory: entry
                .game_directory
                .unwrap_or_else(|| "baseq3".into()),
            game_description: "Quake Live".into(),
            app_id: entry.app_id.unwrap_or(282_440),
            players: entry.players.unwrap_or(0),
            max_players: entry.max_players.unwrap_or(0),
            bots: entry.bots.unwrap_or(0),
            ping_ms: None,
            region: entry.region,
            version: None,
            keywords: merge_server_keywords(entry.keywords, entry.gametype),
            connect_url: format!("+connect {}", entry.addr),
            players_info: Vec::new(),
        });
    }

    servers.sort_by(|left, right| {
        right.players.cmp(&left.players).then_with(|| {
            left.ping_ms
                .unwrap_or(u128::MAX)
                .cmp(&right.ping_ms.unwrap_or(u128::MAX))
        })
    });

    log::info!("Returning {} enriched server rows", servers.len());

    Ok(servers)
}

#[tauri::command]
async fn fetch_server_players(addr: String) -> Result<Vec<ServerPlayer>, String> {
    log::info!("fetch_server_players called for {}", addr);

    let addr_clone = addr.clone();
    tauri::async_runtime::spawn_blocking(move || query_players(&addr_clone))
        .await
        .map_err(|error| format!("Player query task failed: {error}"))?
}

#[tauri::command]
async fn fetch_server_countries(addrs: Vec<String>) -> Result<Vec<ServerCountryLocation>, String> {
    let mut addrs_by_ip: HashMap<String, Vec<String>> = HashMap::new();
    for addr in addrs {
        let normalized_addr = normalize_addr(&addr);
        let ip = extract_host(&normalized_addr).to_string();
        let entries = addrs_by_ip.entry(ip).or_default();
        if !entries.contains(&normalized_addr) {
            entries.push(normalized_addr);
        }
    }

    if addrs_by_ip.is_empty() {
        return Ok(Vec::new());
    }

    log::info!(
        "fetch_server_countries called for {} server addresses across {} unique IPs",
        addrs_by_ip.values().map(Vec::len).sum::<usize>(),
        addrs_by_ip.len()
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("QLTracker/0.1.0")
        .build()
        .map_err(|error| error.to_string())?;

    let unique_ips: Vec<_> = addrs_by_ip.keys().cloned().collect();
    let mut locations =
        Vec::with_capacity(addrs_by_ip.values().map(Vec::len).sum::<usize>());

    for chunk in unique_ips.chunks(5) {
        let tasks: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|ip| {
                let client = client.clone();
                tauri::async_runtime::spawn(async move {
                    let location = match fetch_country_location(&client, &ip).await {
                        Ok(location) => location,
                        Err(error) => {
                            log::warn!("{error}");
                            ServerCountryLocation {
                                addr: ip.clone(),
                                ip: ip.clone(),
                                country_name: None,
                                country_code: None,
                            }
                        }
                    };

                    (ip, location)
                })
            })
            .collect();

        for task in tasks {
            let (ip, location) = task
                .await
                .map_err(|error| format!("Country lookup task failed: {error}"))?;

            if let Some(addrs_for_ip) = addrs_by_ip.get(&ip) {
                for addr in addrs_for_ip {
                    locations.push(ServerCountryLocation {
                        addr: addr.clone(),
                        ip: location.ip.clone(),
                        country_name: location.country_name.clone(),
                        country_code: location.country_code.clone(),
                    });
                }
            }
        }
    }

    Ok(locations)
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
struct ServerPing {
    addr: String,
    ping_ms: Option<u128>,
    requires_password: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
struct ServerMode {
    addr: String,
    game_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QlStatsServerInfo {
    #[serde(default)]
    gt: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QlStatsServerResponse {
    #[serde(default)]
    serverinfo: Option<QlStatsServerInfo>,
    #[serde(default)]
    players: Vec<serde_json::Value>,
}

fn qlstats_value_as_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|field| field.as_str())
        .map(|field| field.trim().to_string())
        .filter(|field| !field.is_empty())
}

fn qlstats_value_as_f64(value: &serde_json::Value, key: &str) -> Option<f64> {
    let field = value.get(key)?;

    match field {
        serde_json::Value::Number(number) => number.as_f64(),
        serde_json::Value::String(string) => string.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn calculate_average(values: impl IntoIterator<Item = Option<f64>>) -> Option<f64> {
    let mut total = 0.0;
    let mut count = 0_u32;

    for value in values {
        if let Some(value) = value {
            total += value;
            count += 1;
        }
    }

    if count == 0 {
        return None;
    }

    Some((total / f64::from(count)).round())
}

fn qlstats_player_to_rating(player: &serde_json::Value) -> ServerPlayerRating {
    let steam_id = qlstats_value_as_string(player, "steamid")
        .or_else(|| qlstats_value_as_string(player, "steam_id"));
    let name = qlstats_value_as_string(player, "name")
        .or_else(|| qlstats_value_as_string(player, "nick"))
        .or_else(|| qlstats_value_as_string(player, "client_name"))
        .unwrap_or_else(|| "Unknown player".into());
    let qelo = qlstats_value_as_f64(player, "rating")
        .or_else(|| qlstats_value_as_f64(player, "elo"));

    ServerPlayerRating {
        name,
        steam_id,
        qelo,
        trueskill: None,
    }
}

fn extract_rating_number(input: &str) -> Option<f64> {
    let lowered = input.to_lowercase();
    let keywords = ["trueskill", "rating", "elo", "mu"];

    for keyword in keywords {
        let mut search_start = 0;
        while let Some(index) = lowered[search_start..].find(keyword) {
            let absolute_index = search_start + index;
            let tail = &lowered[absolute_index + keyword.len()..];
            if let Some(value) = extract_first_plausible_number(tail) {
                return Some(value);
            }
            search_start = absolute_index + keyword.len();
        }
    }

    None
}

fn extract_first_plausible_number(input: &str) -> Option<f64> {
    let mut buffer = String::new();
    let mut seen_dot = false;

    for character in input.chars() {
        if character.is_ascii_digit() || (buffer.is_empty() && character == '-') {
            buffer.push(character);
            continue;
        }

        if character == '.' && !seen_dot && !buffer.is_empty() {
            seen_dot = true;
            buffer.push(character);
            continue;
        }

        if !buffer.is_empty() && buffer != "-" {
            if let Ok(value) = buffer.parse::<f64>() {
                if value.is_finite() && value > 0.0 && value < 10_000.0 && value != 1500.0 {
                    return Some(value);
                }
            }
        }

        if !buffer.is_empty() {
            break;
        }
    }

    if !buffer.is_empty() && buffer != "-" {
        if let Ok(value) = buffer.parse::<f64>() {
            if value.is_finite() && value > 0.0 && value < 10_000.0 && value != 1500.0 {
                return Some(value);
            }
        }
    }

    None
}

async fn fetch_trueskill(
    client: &reqwest::Client,
    url_template: &str,
    steam_id: &str,
) -> Option<f64> {
    let trimmed_template = url_template.trim();
    if trimmed_template.is_empty() {
        return None;
    }

    let url = if trimmed_template.contains("%s") {
        trimmed_template.replace("%s", steam_id)
    } else {
        format!("{}/{}", trimmed_template.trim_end_matches('/'), steam_id)
    };

    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    let body = response.text().await.ok()?;

    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
        if let Some(number) = json.as_f64() {
            return Some(number);
        }

        for key in ["elo", "trueskill", "rating", "mu"] {
            if let Some(number) = json.get(key).and_then(|value| value.as_f64()) {
                return Some(number);
            }
            if let Some(number) = json
                .get(key)
                .and_then(|value| value.as_str())
                .and_then(|value| value.trim().parse::<f64>().ok())
            {
                return Some(number);
            }
        }
    }

    extract_rating_number(&body)
}

#[tauri::command]
async fn fetch_server_pings(addrs: Vec<String>) -> Result<Vec<ServerPing>, String> {
    let unique_addrs = addrs.into_iter().fold(Vec::new(), |mut acc, addr| {
        let normalized_addr = normalize_addr(&addr);
        if !acc.contains(&normalized_addr) {
            acc.push(normalized_addr);
        }
        acc
    });

    if unique_addrs.is_empty() {
        return Ok(Vec::new());
    }

    log::info!(
        "fetch_server_pings called for {} server addresses",
        unique_addrs.len()
    );

    let tasks: Vec<_> = unique_addrs
        .into_iter()
        .map(|addr| {
            tauri::async_runtime::spawn_blocking(move || {
                let (ping_ms, requires_password) = match query_ping(&addr) {
                    Ok(probe) => (Some(probe.ping_ms), probe.requires_password),
                    Err(error) => {
                        log::warn!("Ping lookup failed for {}: {}", addr, error);
                        (None, None)
                    }
                };

                ServerPing {
                    addr,
                    ping_ms,
                    requires_password,
                }
            })
        })
        .collect();

    let mut pings = Vec::with_capacity(tasks.len());
    for task in tasks {
        pings.push(
            task.await
                .map_err(|error| format!("Ping lookup task failed: {error}"))?,
        );
    }

    Ok(pings)
}

async fn fetch_server_mode(
    client: &reqwest::Client,
    base_url: &str,
    addr: &str,
) -> Result<ServerMode, String> {
    let normalized_addr = normalize_addr(addr);

    if let Some(cached) = mode_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&normalized_addr)
        .cloned()
    {
        return Ok(ServerMode {
            addr: normalized_addr,
            game_mode: cached,
        });
    }

    let normalized_base = base_url.trim().trim_end_matches('/');
    if normalized_base.is_empty() {
        return Err("QLStats API URL is required.".into());
    }

    let response = client
        .get(format!(
            "{}/server/{}/players",
            normalized_base,
            urlencoding::encode(&normalized_addr)
        ))
        .send()
        .await
        .map_err(|error| format!("QLStats mode request failed for {}: {}", normalized_addr, error))?;

    if !response.status().is_success() {
        return Err(format!(
            "QLStats returned HTTP {} for {}.",
            response.status(),
            normalized_addr
        ));
    }

    let payload = response
        .json::<QlStatsServerResponse>()
        .await
        .map_err(|error| format!("QLStats mode response was invalid for {}: {}", normalized_addr, error))?;

    let game_mode = payload.serverinfo.and_then(|serverinfo| serverinfo.gt);

    mode_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(normalized_addr.clone(), game_mode.clone());

    Ok(ServerMode {
        addr: normalized_addr,
        game_mode,
    })
}

async fn fetch_qlstats_server_player_ratings(
    client: &reqwest::Client,
    qlstats_base_url: &str,
    addr: &str,
) -> Result<Vec<ServerPlayerRating>, String> {
    let normalized_addr = normalize_addr(addr);
    let normalized_base = qlstats_base_url.trim().trim_end_matches('/');
    if normalized_base.is_empty() {
        return Err("QLStats API URL is required.".into());
    }

    let response = client
        .get(format!(
            "{}/server/{}/players",
            normalized_base,
            urlencoding::encode(&normalized_addr)
        ))
        .send()
        .await
        .map_err(|error| {
            format!(
                "QLStats player ratings request failed for {}: {}",
                normalized_addr, error
            )
        })?;

    if !response.status().is_success() {
        return Err(format!(
            "QLStats returned HTTP {} for {}.",
            response.status(),
            normalized_addr
        ));
    }

    let payload = response
        .json::<QlStatsServerResponse>()
        .await
        .map_err(|error| {
            format!(
                "QLStats player ratings response was invalid for {}: {}",
                normalized_addr, error
            )
        })?;

    Ok(payload
        .players
        .iter()
        .map(qlstats_player_to_rating)
        .collect())
}

async fn fetch_server_player_ratings_impl(
    client: &reqwest::Client,
    qlstats_base_url: &str,
    trueskill_url_template: &str,
    addr: &str,
) -> Result<Vec<ServerPlayerRating>, String> {
    let normalized_addr = normalize_addr(addr);

    if let Some(cached) = player_rating_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&normalized_addr)
        .cloned()
    {
        return Ok(cached);
    }

    let mut ratings = fetch_qlstats_server_player_ratings(client, qlstats_base_url, &normalized_addr)
        .await?;

    for rating in &mut ratings {
        rating.trueskill = if let Some(ref steam_id) = rating.steam_id {
            fetch_trueskill(client, trueskill_url_template, steam_id).await
        } else {
            None
        };
    }

    player_rating_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(normalized_addr, ratings.clone());

    Ok(ratings)
}

async fn fetch_server_rating_summary_impl(
    client: &reqwest::Client,
    qlstats_base_url: &str,
    trueskill_url_template: &str,
    rating_kind: &str,
    addr: &str,
) -> Result<ServerRatingSummary, String> {
    let normalized_addr = normalize_addr(addr);
    let cache_key = format!("{}:{}", rating_kind.trim().to_lowercase(), normalized_addr);

    if let Some(cached) = rating_summary_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&cache_key)
        .cloned()
    {
        return Ok(cached);
    }

    let summary = match rating_kind.trim().to_lowercase().as_str() {
        "trueskill" => {
            let ratings = fetch_server_player_ratings_impl(
                client,
                qlstats_base_url,
                trueskill_url_template,
                &normalized_addr,
            )
            .await?;

            ServerRatingSummary {
                addr: normalized_addr.clone(),
                average_qelo: calculate_average(ratings.iter().map(|player| player.qelo)),
                average_trueskill: calculate_average(
                    ratings.iter().map(|player| player.trueskill),
                ),
            }
        }
        _ => {
            let ratings =
                fetch_qlstats_server_player_ratings(client, qlstats_base_url, &normalized_addr)
                    .await?;

            ServerRatingSummary {
                addr: normalized_addr.clone(),
                average_qelo: calculate_average(ratings.iter().map(|player| player.qelo)),
                average_trueskill: None,
            }
        }
    };

    rating_summary_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(cache_key, summary.clone());

    Ok(summary)
}

#[tauri::command]
async fn fetch_server_modes(
    base_url: String,
    addrs: Vec<String>,
) -> Result<Vec<ServerMode>, String> {
    let unique_addrs = addrs.into_iter().fold(Vec::new(), |mut acc, addr| {
        let normalized_addr = normalize_addr(&addr);
        if !acc.contains(&normalized_addr) {
            acc.push(normalized_addr);
        }
        acc
    });

    if unique_addrs.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("QLTracker/0.1.0")
        .build()
        .map_err(|error| error.to_string())?;

    let tasks: Vec<_> = unique_addrs
        .into_iter()
        .map(|addr| {
            let client = client.clone();
            let base_url = base_url.clone();
            tauri::async_runtime::spawn(async move {
                match fetch_server_mode(&client, &base_url, &addr).await {
                    Ok(mode) => mode,
                    Err(error) => {
                        log::warn!("{error}");
                        ServerMode {
                            addr,
                            game_mode: None,
                        }
                    }
                }
            })
        })
        .collect();

    let mut modes = Vec::with_capacity(tasks.len());
    for task in tasks {
        modes.push(
            task.await
                .map_err(|error| format!("Mode lookup task failed: {error}"))?,
        );
    }

    Ok(modes)
}

#[tauri::command]
async fn fetch_server_player_ratings(
    qlstats_base_url: String,
    trueskill_url_template: String,
    addr: String,
) -> Result<Vec<ServerPlayerRating>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("QLTracker/0.1.0")
        .build()
        .map_err(|error| error.to_string())?;

    fetch_server_player_ratings_impl(&client, &qlstats_base_url, &trueskill_url_template, &addr)
        .await
}

#[tauri::command]
async fn fetch_server_rating_summaries(
    qlstats_base_url: String,
    trueskill_url_template: String,
    addrs: Vec<String>,
    rating_kind: String,
) -> Result<Vec<ServerRatingSummary>, String> {
    let unique_addrs = addrs.into_iter().fold(Vec::new(), |mut acc, addr| {
        let normalized_addr = normalize_addr(&addr);
        if !acc.contains(&normalized_addr) {
            acc.push(normalized_addr);
        }
        acc
    });

    if unique_addrs.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .user_agent("QLTracker/0.1.0")
        .build()
        .map_err(|error| error.to_string())?;

    let mut summaries = Vec::with_capacity(unique_addrs.len());

    for chunk in unique_addrs.chunks(12) {
        let tasks: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|addr| {
                let client = client.clone();
                let qlstats_base_url = qlstats_base_url.clone();
                let trueskill_url_template = trueskill_url_template.clone();
                let rating_kind = rating_kind.clone();
                tauri::async_runtime::spawn(async move {
                    match fetch_server_rating_summary_impl(
                        &client,
                        &qlstats_base_url,
                        &trueskill_url_template,
                        &rating_kind,
                        &addr,
                    )
                    .await
                    {
                        Ok(summary) => summary,
                        Err(error) => {
                            log::warn!("{error}");
                            ServerRatingSummary {
                                addr,
                                average_qelo: None,
                                average_trueskill: None,
                            }
                        }
                    }
                })
            })
            .collect();

        for task in tasks {
            summaries.push(
                task.await
                    .map_err(|error| format!("Rating summary task failed: {error}"))?,
            );
        }
    }

    Ok(summaries)
}

#[tauri::command]
fn app_is_packaged() -> bool {
    !cfg!(debug_assertions)
}

#[tauri::command]
fn launcher_exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn launcher_restart_app(app: tauri::AppHandle) {
    app.request_restart();
}

#[tauri::command]
fn launcher_finish_bootstrap(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = ensure_main_window(&app)?;
    focus_window(&main_window);

    if let Some(window) = app.get_webview_window("bootstrap") {
        window.close().map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn ensure_main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("main") {
        return Ok(window);
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or_else(|| "Main window configuration not found".to_string())?;

    tauri::WebviewWindowBuilder::from_config(app, config)
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())
}

fn focus_window(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
        .invoke_handler(tauri::generate_handler![
            app_is_packaged,
            fetch_quake_live_servers,
            launcher_exit_app,
            launcher_finish_bootstrap,
            launcher_restart_app,
            fetch_server_players,
            fetch_server_player_ratings,
            fetch_server_rating_summaries,
            fetch_server_countries,
            fetch_server_pings,
            fetch_server_modes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
