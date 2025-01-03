const dgram = require('dgram');

const PACKET_HEADER_SIZE = 10;
const SAMPPACKET_IDENTIFIER = 'SAMP';
const RESPONSE_CODES = {
    INFO: 'i',
    RULES: 'r',
    PLAYERS: 'd',
};

const query = (options, callback) => {
    if (typeof options === 'string') options.host = options;
    options.port = options.port || 7777;
    options.timeout = options.timeout || 1000;

    if (!options.host || !isValidPort(options.port)) {
        return callback('Invalid host or port');
    }

    const response = {};

    request(options, RESPONSE_CODES.INFO, (error, information) => {
        if (error) return callback(error);

        response.address = options.host;
        response.hostname = information.hostname;
        response.gamemode = information.gamemode;
        response.mapname = information.mapname;
        response.passworded = information.passworded === 1;
        response.maxplayers = information.maxplayers;
        response.online = information.players;

        request(options, RESPONSE_CODES.RULES, (error, rules) => {
            if (error) return callback(error);

            rules.lagcomp = rules.lagcomp === 'On';
            rules.weather = parseInt(rules.weather, 10);
            response.rules = rules;

            if (response.online > 100) {
                response.players = [];
                return callback(null, response);
            }

            request(options, RESPONSE_CODES.PLAYERS, (error, players) => {
                if (error) return callback(error);
                response.players = players;
                callback(null, response);
            });
        });
    });
};

const request = (options, opcode, callback) => {
    const socket = dgram.createSocket('udp4');
    const packet = createPacket(options, opcode);

    try {
        socket.send(packet, 0, packet.length, options.port, options.host, (error, bytes) => {
            if (error) return callback(error);
        });
    } catch (error) {
        return callback(error);
    }

    const timeoutController = setTimeout(() => {
        socket.close();
        callback('Host unavailable');
    }, options.timeout);

    socket.on('message', (message) => {
        clearTimeout(timeoutController);

        if (message.length < PACKET_HEADER_SIZE) {
            return callback(true);
        }

        socket.close();
        processMessage(opcode, message.slice(PACKET_HEADER_SIZE), callback);
    });
};

const createPacket = (options, opcode) => {
    const packet = Buffer.alloc(PACKET_HEADER_SIZE + opcode.length);
    packet.write(SAMPPACKET_IDENTIFIER);

    const hostParts = options.host.split('.');
    hostParts.forEach((part, index) => {
        packet[4 + index] = parseInt(part);
    });

    packet[8] = options.port & 0xFF;
    packet[9] = options.port >> 8 & 0xFF;
    packet[10] = opcode.charCodeAt(0);

    return packet;
};

const processMessage = (opcode, message, callback) => {
    let offset = 0;
    let object = {};

    try {
        if (opcode === RESPONSE_CODES.INFO) {
            object = parseInfoMessage(message, offset);
        } else if (opcode === RESPONSE_CODES.RULES) {
            object = parseRulesMessage(message, offset);
        } else if (opcode === RESPONSE_CODES.PLAYERS) {
            object = parsePlayersMessage(message, offset);
        }
        callback(null, object);
    } catch (exception) {
        callback(exception);
    }
};

const parseInfoMessage = (message, offset) => {
    let object = {};

    object.passworded = message.readUInt8(offset++);
    object.players = message.readUInt16LE(offset); offset += 2;
    object.maxplayers = message.readUInt16LE(offset); offset += 2;
    object.hostname = readString(message, offset); offset += object.hostname.length + 2;
    object.gamemode = readString(message, offset); offset += object.gamemode.length + 2;
    object.mapname = readString(message, offset);

    return object;
};

const parseRulesMessage = (message, offset) => {
    let object = {};
    const ruleCount = message.readUInt16LE(offset); offset += 2;

    for (let i = 0; i < ruleCount; i++) {
        const property = readString(message, offset); offset += property.length + 1;
        const value = readString(message, offset); offset += value.length + 1;
        object[property] = value;
    }

    return object;
};

const parsePlayersMessage = (message, offset) => {
    const playerCount = message.readUInt16LE(offset); offset += 2;
    const players = [];

    for (let i = 0; i < playerCount; i++) {
        let player = {};
        player.id = message.readUInt8(offset++);
        player.name = readString(message, offset); offset += player.name.length + 1;
        player.score = message.readUInt16LE(offset); offset += 2;
        player.ping = message.readUInt16LE(offset); offset += 2;
        players.push(player);
    }

    return players;
};

const readString = (message, offset) => {
    const length = message.readUInt16LE(offset); offset += 2;
    return message.slice(offset, offset + length).toString('utf8');
};

const isValidPort = (port) => {
    return Number.isFinite(port) && port >= 1 && port <= 65535;
};

module.exports = query;
