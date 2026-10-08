import {
  getMetadata,
  setMetadata,
} from "./db";

const DEVICE_ID_KEY = "deviceId";

function generateDeviceId() {
  const random =
    crypto.randomUUID();

  return `SCANNER-${random}`;
}

export async function getDeviceId() {
  let deviceId =
    await getMetadata(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId =
      generateDeviceId();

    await setMetadata(
      DEVICE_ID_KEY,
      deviceId
    );
  }

  return deviceId;
}