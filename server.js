// server.js - Main Express server file

const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");


dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

async function getSecret() {
  const secret_name = "ecs/cloud-final/oiiatype-s3";
  const client = new SecretsManagerClient({ region: "ap-southeast-2" });

  try {
    const secret_response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
      })
    );

    const secret = secret_response.SecretString;
    return JSON.parse(secret);
  } catch (error) {
    throw error;
  }
}

async function getSongData(level, id) {
  const secret = await getSecret();
  const client = new S3Client({ region: secret.region });
  const songKey = `${level}/${id}/song.json`;
  const trackKey = `${level}/${id}/track.mp3`;

  try {
    console.log(`Fetching song data: ${songKey}`);
    const response = await client.send(
      new GetObjectCommand({
        Bucket: secret.S3_BUCKET_NAME,
        Key: songKey
      }));

    const str = await response.Body.transformToString();
    const songObj = JSON.parse(str);

    const trackUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: secret.S3_BUCKET_NAME,
        Key: trackKey
      }),
      { expiresIn: 3600 }
    );

    console.log(`Successfully retrieved song and generated track URL for: ${level}/${id}`);

    return {
      name    : songObj.metadata.name,
      duration: songObj.metadata.duration,
      track   : trackUrl,
      lyrics  : songObj.lyrics
    };
  } catch (error) {
    console.log(`Error retrieving song data for ${level}/${id}:`, error.name);
    throw new Error('NoSuchKey');
  }
}


app.get('/:level/:id', async (req, res) => {
  const { level, id } = req.params;
  console.log(`------------------------------------------`);
  console.log(`Incoming GET request for /${level}/${id}`);

  if (!['simple', 'medium', 'hard'].includes(level)) {
    console.log(`Invalid level received: ${level}`);
    return res.status(400).json({ error: 'Invalid level. Must be simple, medium, or hard.' });
  }

  try {
    const songData = await getSongData(level, id);
    res.status(200).json({ status: 'ok', body: songData });
  } catch (error) {
    if (error.message === 'NoSuchKey') {
      res.status(404).json({ error: 'Song not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;