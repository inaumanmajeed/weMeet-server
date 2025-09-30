import * as mediasoup from 'mediasoup';

let worker;
let rooms = new Map();

export async function createWorker() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  });

  console.log('✅ mediasoup worker created');

  worker.on('died', () => {
    console.error('❌ mediasoup worker died, exiting...');
    process.exit(1);
  });

  return worker;
}

export async function createRoom(roomId) {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  if (!worker) {
    worker = await createWorker();
  }

  const mediaCodecs = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
    },
  ];

  const router = await worker.createRouter({ mediaCodecs });

  const room = {
    roomId,
    router,
    peers: new Map(),
  };

  rooms.set(roomId, room);
  console.log(`✅ Room ${roomId} created`);

  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}
