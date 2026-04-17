import dgram from "node:dgram";

const A2S_RULES_CHALLENGE_REQUEST = Buffer.from([
  0xff, 0xff, 0xff, 0xff, 0x56, 0xff, 0xff, 0xff, 0xff,
]);
const A2S_CHALLENGE_RESPONSE_HEADER = 0x41;
const A2S_RULES_RESPONSE_HEADER = 0x45;
const SIMPLE_PACKET_HEADER = -1;
const SPLIT_PACKET_HEADER = -2;
const SOCKET_TIMEOUT_MS = 6_000;

type SplitPacketFragment = {
  id: number;
  number: number;
  payload: Buffer;
  total: number;
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
  const start = offsetRef.offset;
  let end = start;

  while (end < buffer.length && buffer[end] !== 0) {
    end += 1;
  }

  offsetRef.offset = Math.min(end + 1, buffer.length);
  return buffer.subarray(start, end).toString("utf8");
}

function isSimplePacket(buffer: Buffer) {
  return buffer.length >= 5 && buffer.readInt32LE(0) === SIMPLE_PACKET_HEADER;
}

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

async function sendAndReceive(host: string, port: number, payload: Buffer) {
  const socket = dgram.createSocket("udp4");

  return new Promise<Buffer>((resolve, reject) => {
    const splitPackets = new Map<number, Array<Buffer | undefined>>();
    let closed = false;

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("A2S rules query timed out."));
    }, SOCKET_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off("error", handleError);
      socket.off("message", handleMessage);

      if (!closed) {
        closed = true;
        socket.close();
      }
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
        reject(new Error("Unexpected A2S rules packet format."));
        return;
      }

      const parts =
        splitPackets.get(fragment.id) ??
        Array<Buffer | undefined>(fragment.total);
      parts[fragment.number] = fragment.payload;
      splitPackets.set(fragment.id, parts);

      if (
        parts.filter((part): part is Buffer => part != null).length !==
        fragment.total
      ) {
        return;
      }

      cleanup();
      const merged = Buffer.concat(parts as Buffer[]);
      resolve(
        isSimplePacket(merged)
          ? merged
          : Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff]), merged])
      );
    };

    socket.on("error", handleError);
    socket.on("message", handleMessage);
    socket.send(payload, port, host, (error) => {
      if (error) {
        cleanup();
        reject(error);
      }
    });
  });
}

function parseChallengeResponse(buffer: Buffer) {
  if (!isSimplePacket(buffer) || buffer[4] !== A2S_CHALLENGE_RESPONSE_HEADER) {
    return null;
  }

  if (buffer.length < 9) {
    throw new Error("A2S rules challenge response was too short.");
  }

  return buffer.subarray(5, 9);
}

function parseRulesResponse(buffer: Buffer) {
  if (!isSimplePacket(buffer)) {
    throw new Error("Expected a simple A2S rules packet.");
  }

  if (buffer[4] !== A2S_RULES_RESPONSE_HEADER) {
    throw new Error(
      `Unexpected A2S rules header 0x${(buffer[4] ?? 0)
        .toString(16)
        .padStart(2, "0")}.`
    );
  }

  const offsetRef = { offset: 5 };
  const ruleCount = buffer.readUInt16LE(offsetRef.offset);
  offsetRef.offset += 2;

  const rules: Record<string, string> = {};
  for (
    let index = 0;
    index < ruleCount && offsetRef.offset < buffer.length;
    index += 1
  ) {
    const name = readCString(buffer, offsetRef);
    const value = readCString(buffer, offsetRef);
    rules[name] = value;
  }

  return rules;
}

export async function queryServerRules(addr: string) {
  const { host, port } = parseSocketTarget(addr);
  const challengeResponse = await sendAndReceive(
    host,
    port,
    A2S_RULES_CHALLENGE_REQUEST
  );
  const challenge = parseChallengeResponse(challengeResponse);

  if (!challenge) {
    throw new Error(
      `Unexpected A2S rules challenge header 0x${(challengeResponse[4] ?? 0)
        .toString(16)
        .padStart(2, "0")}.`
    );
  }

  const response = await sendAndReceive(
    host,
    port,
    Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x56]),
      challenge,
    ])
  );

  return parseRulesResponse(response);
}
