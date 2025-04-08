// server.js - Main Express server file

const express = require('express');
const { S3Client, GetObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Browser access
app.use(cors());

var corsOptions = {
    origin: 'localhost:3000',
    optionsSuccessStatus: 200
}

async function getSongData(level, id) {
  try {
    const client = new S3Client({
      // region: process.env.AWS_REGION,
      // credentials: {
      //   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      // }
    });

    const songJsonParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        // Key: `/${process.env.S3_BUCKET_NAME}/${level}/${id}/song.json`
        Key: `test.jpg`
    };
    
    const list = await client.send(new ListObjectsCommand({ Bucket: process.env.S3_BUCKET_NAME }));
    // console.log(list.Contents);

    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${level}/${id}/song.json`
      }));

    const str = await response.Body.transformToString();
    const songObj = JSON.parse(str)
    // console.log(song_obj);
    
    const trackUrl = await getSignedUrl(
      client, 
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${level}/${id}/track.mp3`
      }), 
      { 
        expiresIn: 3600 
      });
    
    return {
        name: songObj.metadata.name,
        duration: songObj.metadata.duration,
        track: trackUrl,
        lyrics: songObj.lyrics
    };
    } catch (error) {
    console.error('Error retrieving song data:', error);
    throw error;
    }
}

// // Get song list
app.get('/:level/:id', async (req, res) => {
  const { level, id } = req.params;
  
  // Validate level parameter
  if (!['simple', 'medium', 'hard'].includes(level)) {
    return res.status(400).json({ error: 'Invalid level. Must be simple, medium, or hard.' });
  }
  
  try {
    const songData = await getSongData(level, id);
    res.status(200).json({ status: 'ok', body: songData })
  } catch (error) {
    if (error.code === 'NoSuchKey') {
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