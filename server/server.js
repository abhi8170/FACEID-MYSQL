/*******************************************************
 * server.js - Express Server with MySQL Integration
 * Face Recognition Demo using face-api.js (client-side)
 * Auto-Matching + Cosine Similarity
 *******************************************************/
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');

const app = express();
const port = 3000;

// Configure body parser for large payloads
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files (index.html, script.js, models, etc.) from ../client
app.use(express.static(path.join(__dirname, '../client')));

// ----------------------
// MySQL Database Setup
// ----------------------
const dbConfig = {
  host: 'localhost',
  user: 'root',         // Change if needed
  password: 'your_password', // Change if needed
  database: 'face_db',  // Ensure this DB exists
  socketPath: '/var/run/mysqld/mysqld.sock' // Uncomment/adjust if needed
};

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL as ID ' + connection.threadId);

  // Create table if it does not exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      embedding TEXT NOT NULL,
      image LONGBLOB NOT NULL
    )
  `;
  connection.query(createTableQuery, (err) => {
    if (err) {
      console.error("Error creating table:", err);
    } else {
      console.log("Table 'users' is ready or already exists.");
    }
  });
});

// ----------------------
// Helper: Cosine Similarity
// ----------------------
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return -1;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normA += vec1[i] * vec1[i];
    normB += vec2[i] * vec2[i];
  }
  if (normA === 0 || normB === 0) return -1;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ----------------------
// POST /register
// ----------------------
app.post('/register', (req, res) => {
  console.log("Received /register request:", req.body);
  const { name, embedding, image } = req.body;
  if (!name || !embedding || !image) {
    return res.status(400).json({ message: "Missing required fields (name, embedding, image)." });
  }

  // Convert base64 image to Buffer for storage as BLOB
  const imageData = image.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(imageData, 'base64');

  // Store embedding as JSON string
  const embeddingJson = JSON.stringify(embedding);

  // Insert into MySQL
  const insertQuery = 'INSERT INTO users (name, embedding, image) VALUES (?, ?, ?)';
  connection.query(insertQuery, [name, embeddingJson, imageBuffer], (err, results) => {
    if (err) {
      console.error("Error inserting registration:", err);
      return res.status(500).json({ message: "Database error on registration." });
    }
    console.log(`Registered: ${name} (ID: ${results.insertId})`);
    return res.json({ message: "Registration successful." });
  });
});

// ----------------------
// POST /match
// ----------------------
app.post('/match', (req, res) => {
  console.log("Received /match request:", req.body);
  const { embedding } = req.body;
  if (!embedding) {
    return res.status(400).json({ message: "Missing embedding." });
  }

  // Retrieve all users from MySQL
  const selectQuery = 'SELECT * FROM users';
  connection.query(selectQuery, (err, results) => {
    if (err) {
      console.error("Error fetching registrations:", err);
      return res.status(500).json({ message: "Database error on matching." });
    }

    if (results.length === 0) {
      return res.json({ matchFound: false, message: "No registrations available." });
    }

    let bestMatch = null;
    let bestSimilarity = -1;

    results.forEach(row => {
      // Parse the stored embedding (JSON) back to an array
      const storedEmbedding = JSON.parse(row.embedding);
      const similarity = cosineSimilarity(embedding, storedEmbedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = row;
      }
    });

    // Threshold for deciding a match
    const threshold = 0.8;
    if (bestSimilarity >= threshold && bestMatch) {
      // Convert the LONGBLOB image back to base64
      const imageBase64 = "data:image/png;base64," + bestMatch.image.toString('base64');
      return res.json({
        matchFound: true,
        name: bestMatch.name,
        similarity: bestSimilarity,
        image: imageBase64
      });
    } else {
      return res.json({ matchFound: false, message: "No matching face found." });
    }
  });
});

// ----------------------
// GET / - serve index.html
// ----------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ----------------------
// Start the Server
// ----------------------
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
