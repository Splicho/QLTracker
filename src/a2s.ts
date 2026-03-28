import dgram from "node:dgram";

const A2S_PLAYER_HEADER = Buffer.from([
  0xff, 0xff, 0xff, 0xff, 0x55, 0xff, 0xff, 0xff, 0xff,
]);
const SIMPLE_PACKET_HEADER = -1;
const SPLIT_PACKET_HEADER = -2;
const A2S_CHALLENGE_HEADER = 0x41;
const A2S_PLAYER_RESPONSE_HEADER = 0x44;
const SOCKET_TIMEOUT_MS = 4000;

export type A2sPlayer = {
  name: string;
  score: number;
  durationSeconds: number;
};

function normalizeAddr(addr: string) {
  return addr.includes(":") ? addr : `${addr}:27960`;
}

function parseSocketTarget(addr: string) {
  const normalizedAddr = normalizeAddr(addr);
  const separatorIndex = normalizedAddr.lastIndexOf(":");
  if (separatorIndex <= 0 || separatorIndex === normalizedAddr.length - 1) {
    throw new Error(`Invalid server address '${addr}'.`);
  }

  const host = normalizedAddr.slice(0, separatorIndex);
  const port = Number(normalizedAddr.slice(separatorIndex + 1));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid server port in '${addr}'.`);
  }

  return { host, port };
}

function readCString(buffer: Buffer, offsetRef: { offset: number }) {
  if (offsetRef.offset >= buffer.length) {
    return "";
  }

  let end = offsetRef.offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end += 1;
  }

  const value = buffer.subarray(offsetRef.offset, end).toString("utf8");
  offsetRef.offset = Math.min(end + 1, buffer.length);
  return value;
}

function parsePlayerResponse(buffer: Buffer) {
  if (buffer.length < 6) {
    throw new Error("A2S player response was too short.");
  }

  if (
    buffer[0] !== 0xff ||
    buffer[1] !== 0xff ||
    buffer[2] !== 0xff ||
    buffer[3] !== 0xff ||
    buffer[4] !== A2S_PLAYER_RESPONSE_HEADER
  ) {
    throw new Error("Unexpected A2S player response header.");
  }

  const playerCount = buffer[5] ?? 0;
  const offsetRef = { offset: 6 };
  const players: A2sPlayer[] = [];

  for (let index = 0; index < playerCount && offsetRef.offset < buffer.length; index += 1) {
    offsetRef.offset += 1; // player index
    const name = readCString(buffer, offsetRef) || "Unknown player";

    if (offsetRef.offset + 8 > buffer.length) {
      break;
    }

    const score = buffer.readInt32LE(offsetRef.offset);
    offsetRef.offset += 4;
    const durationSeconds = buffer.readFloatLE(offsetRef.offset);
    offsetRef.offset += 4;

    players.push({
      name,
      score,
      durationSeconds,
    });
  }

  return players;
}

type SplitPacketFragment = {
  id: number;
  number: number;
  payload: Buffer;
  total: number;
};

function parseSplitPacketFragment(buffer: Buffer): SplitPacketFragment | null {
  if (buffer.length < 12 || buffer.readInt32LE(0) !== SPLIT_PACKET_HEADER) {
    return null;
  }

  const id = buffer.readInt32LE(4);
  const total = buffer[8] ?? 0;
  const number = buffer[9] ?? 0;
  if (total <= 0 || number >= total) {
    return null;
  }

  return {
    id,
    number,
    payload: buffer.subarray(12),
    total,
  };
}

function isSimplePacket(buffer: Buffer) {
  return buffer.length >= 5 && buffer.readInt32LE(0) === SIMPLE_PACKET_HEADER;
}

async function sendAndReceive(
  socket: dgram.Socket,
  host: string,
  port: number,
  payload: Buffer
) {
  return new Promise<Buffer>((resolve, reject) => {
    const splitPackets = new Map<number, Array<Buffer | undefined>>();

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("A2S query timed out."));
    }, SOCKET_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off("error", handleError);
      socket.off("message", handleMessage);
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const handleMessage = (message: Buffer) => {
      if (isSimplePacket(message)) {
        cleanup();
        resolve(message);
        return;
      }

      const fragment = parseSplitPacketFragment(message);
      if (!fragment) {
        cleanup();
        reject(new Error("Unexpected A2S packet format."));
        return;
      }

      const parts = splitPackets.get(fragment.id) ?? Array<Buffer | undefined>(fragment.total);
      parts[fragment.number] = fragment.payload;
      splitPackets.set(fragment.id, parts);

      if (parts.filter((part): part is Buffer => part != null).length !== fragment.total) {
        return;
      }

      cleanup();
      const payload = Buffer.concat(parts as Buffer[]);
      resolve(
        isSimplePacket(payload)
          ? payload
          : Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff]), payload])
      );
    };

    socket.once("error", handleError);
    socket.on("message", handleMessage);
    socket.send(payload, port, host, (error) => {
      if (!error) {
        return;
      }

      cleanup();
      reject(error);
    });
  });
}

export async function queryServerPlayers(addr: string) {
  const { host, port } = parseSocketTarget(addr);
  const socket = dgram.createSocket("udp4");

  try {
    const challengeResponse = await sendAndReceive(
      socket,
      host,
      port,
      A2S_PLAYER_HEADER
    );

    if (challengeResponse[4] === A2S_PLAYER_RESPONSE_HEADER) {
      return parsePlayerResponse(challengeResponse);
    }

    if (
      challengeResponse.length < 9 ||
      !isSimplePacket(challengeResponse) ||
      challengeResponse[4] !== A2S_CHALLENGE_HEADER
    ) {
      throw new Error("Unexpected A2S challenge response.");
    }

    const request = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x55]),
      challengeResponse.subarray(5, 9),
    ]);
    const playersResponse = await sendAndReceive(socket, host, port, request);

    return parsePlayerResponse(playersResponse);
  } finally {
    socket.close();
  }
}
