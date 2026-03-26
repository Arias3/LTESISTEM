import axios from 'axios';
import https from 'https';

const NMS_BASE_URL = process.env.NMS_BASE_URL;
const NMS_NBI_KEY  = process.env.NMS_NBI_KEY;
const CELL_ID      = process.env.NMS_CELL_ID     ?? '1';
const CELL_NUMBER  = process.env.NMS_CELL_NUMBER  ?? '1';
const NODE_NAME    = process.env.NMS_NODE_NAME    ?? 'test';

// Ignora certificado autofirmado del NMS local
const nmsClient = axios.create({
  baseURL: NMS_BASE_URL,
  headers: { Authorization: NMS_NBI_KEY },
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

export const getNodeRadio = async () => {
  const { data } = await nmsClient.get('/api/22.0/enbCellStatus', {
    params: { id: CELL_ID, nodeName: NODE_NAME },
  });

  const cell = data[0];
  return {
    transmitPower:       cell.txPower,
    downloadFrequency:   cell.dlCenterFrequencyMHZ,
    uploadFrequency:     cell.ulCenterFrequencyMHZ,
  };
};

export const getNodeThroughput = async () => {
  const { data } = await nmsClient.get(`/api/22.0/enbStatusIpThroughput/${CELL_ID}`);

  const qciData = (data.cell?.[0]?.qciData ?? []).slice(0, 5);

  let totalDlUsers = 0;
  let totalUlUsers = 0;
  let weightedDl   = 0;
  let weightedUl   = 0;

  for (const qci of qciData) {
    totalDlUsers += qci.activeUeDl;
    totalUlUsers += qci.activeUeUl;
    weightedDl   += qci.ipThroughputKbpsDl * qci.activeUeDl;
    weightedUl   += qci.ipThroughputKbpsUl * qci.activeUeUl;
  }

  return {
    totalDlUsers,
    totalUlUsers,
    dlThroughput: totalDlUsers === 0 ? 0 : weightedDl / totalDlUsers / 1000,
    ulThroughput: totalUlUsers === 0 ? 0 : weightedUl / totalUlUsers / 1000,
  };
};

export const getNodeLocation = async () => {
  const { data } = await nmsClient.get(`/api/22.0/enbCbsdCpiData/${CELL_ID}/${CELL_NUMBER}`);

  return {
    latitude:  data.latitude,
    longitude: data.longitude,
    altitude:  data.height,
  };
};
