const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const userRoutes = express.Router();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use('/api/users', userRoutes);

// PostgreSQL config
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'careasa_db',
  password: 'Pgp@1792004',
  port: 5432,
  connectionTimeoutMillis: 5000,
});

const JWT_SECRET = 'your_jwt_secret_key_here';


//////////////////////////////
//Profile
/////////////////////////////
userRoutes.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'SELECT name, birthday, phone, email, password FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // User profile not found, return empty but valid response
      return res.status(200).json({
        name: '',
        birthday: '',
        phone: '',
        email: '',
        password: ''
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Server error while fetching profile' });
  }
});

// Update or create user profile
userRoutes.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { name, birthday, phone, email, password } = req.body;

  console.log("Received data:", req.body);
  console.log("User ID:", userId);

  try {
    const result = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);

    if (result.rows.length > 0) {
      console.log("Updating existing profile...");
      await pool.query(
        `UPDATE user_profiles
         SET name = $1, birthday = $2, phone = $3, email = $4, password = $5
         WHERE user_id = $6`,
        [name, birthday, phone, email, password, userId]
      );
    } else {
      console.log("Inserting new profile...");
      await pool.query(
        `INSERT INTO user_profiles (user_id, name, birthday, phone, email, password)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, name, birthday, phone, email, password]
      );
    }

    res.status(200).json({ message: 'Profile saved successfully' });
  } catch (err) {
    console.error('Error saving profile:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//////////////////////////
// USER REGISTER / LOGIN
//////////////////////////

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: 'Please fill all fields' });

  try {
    const userCheck = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0)
      return res.status(409).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO app_users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
  } catch (error) {
    console.error('User Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Please provide email and password' });

  try {
    const userQuery = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    if (userQuery.rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password' });

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '50h' });
    res.json({ message: 'Login successful', token, username: user.username, userId: user.id });
  } catch (error) {
    console.error('User Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//////////////////////////
// DOCTOR REGISTER / LOGIN
//////////////////////////

app.post('/doctor/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Please fill all fields' });

  try {
    const doctorCheck = await pool.query('SELECT * FROM doctors WHERE email = $1', [email]);
    if (doctorCheck.rows.length > 0)
      return res.status(409).json({ message: 'Doctor already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newDoctor = await pool.query(
      'INSERT INTO doctors (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: 'Doctor registered successfully', doctor: newDoctor.rows[0] });
  } catch (error) {
    console.error('Doctor Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/doctor/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Please provide email and password' });

  try {
    const doctorQuery = await pool.query('SELECT * FROM doctors WHERE email = $1', [email]);
    if (doctorQuery.rows.length === 0)
      return res.status(401).json({ message: 'Invalid email or password' });

    const doctor = doctorQuery.rows[0];
    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: doctor.id, email: doctor.email }, JWT_SECRET, { expiresIn: '50h' });
    res.json({ message: 'Login successful', token, name: doctor.name, doctorId: doctor.id });
  } catch (error) {
    console.error('Doctor Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//////////////////////////
// CHAT API
//////////////////////////
// GET /messages/:chatId
app.get('/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const result = await pool.query(
      'SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC',
      [chatId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Socket.IO chat logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', ({ chatId }) => {
    socket.join(chatId);
    console.log(`Socket joined room: ${chatId}`);
  });

  socket.on('message', async (data) => {
    console.log('New message received:', data);

    const { chatId, senderId, receiverId, content, type } = data;

    if (!chatId || !senderId || !receiverId || !content || !type) {
      console.log("Invalid message data:", data);
      return;
    }

    try {
      const result = await pool.query(
        'INSERT INTO messages (chat_id, sender_id, receiver_id, message, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [chatId, senderId, receiverId, content, type]
      );
      const savedMessage = result.rows[0];

      io.to(chatId).emit('receive_message', {
        chatId,
        senderId,
        receiverId,
        content,
        type,
        created_at: savedMessage.created_at
      });

    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
//////////////////////////
//  Sleep Quality API
//////////////////////////

app.post('/sleep', async (req, res) => {
  const { userId, sleepLevel } = req.body;

  if (!userId || sleepLevel === undefined) {
    return res.status(400).json({ error: 'Missing userId or sleepLevel' });
  }

  try {
    await pool.query(
      'INSERT INTO sleep_entries (user_id, sleep_level) VALUES ($1, $2)',
      [userId, sleepLevel]
    );
    res.status(200).json({ message: 'Sleep quality recorded successfully' });
  } catch (err) {
    console.error('Error inserting sleep entry:', err);
    res.status(500).json({ error: 'Failed to insert sleep data' });
  }
});

//////////////////////////Expression / Journal API

app.post('/expression', async (req, res) => {
  const { userId, content } = req.body;

  if (!userId || !content) {
    return res.status(400).json({ error: 'Missing userId or content' });
  }

  try {
    await pool.query(
      'INSERT INTO expression_entries (user_id, content) VALUES ($1, $2)',
      [userId, content]
    );
    res.status(200).json({ message: 'Expression recorded successfully' });
  } catch (err) {
    console.error('Error inserting expression entry:', err);
    res.status(500).json({ error: 'Failed to insert expression' });
  }
});
//////////////////////////
// Appointment Booking API
//////////////////////////

app.post('/appointments', async (req, res) => {
  const { userName, userId, doctorId, appointmentDateTime } = req.body;

  if (!userName || !userId || !doctorId || !appointmentDateTime) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newAppointment = await pool.query(
      'INSERT INTO appointments (user_name, user_id, doctor_id, appointment_datetime, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userName, userId, doctorId, appointmentDateTime, 'Pending']
    );

    res.status(201).json({
      message: 'Appointment requested successfully',
      appointment: newAppointment.rows[0]
    });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.put('/api/appointments/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Accepted', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await pool.query(
      'UPDATE appointments SET status = $1 WHERE id = $2',
      [status, id]
    );
    res.json({ message: `Appointment ${status.toLowerCase()}` });
  } catch (err) {
    console.error('Error updating appointment status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
app.get('/api/appointments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, user_name, appointment_datetime, status
      FROM appointments
      ORDER BY appointment_datetime DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

////////////////////////////
///Journelling page
////////////////////////////

app.post('/journal', async (req, res) => {
  const { user_id, emotion, intensity, prompt } = req.body;

  console.log('Incoming Journal Entry:', req.body); // ✅ Log for debugging

  try {
    const result = await pool.query(
      `INSERT INTO journal_entries (id, user_id, emotion, intensity, prompt, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [uuidv4(), user_id, emotion, intensity, prompt]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting journal entry:', err); // ✅ Detailed error
    res.status(500).json({ error: 'Failed to save entry' });
  }
});


app.get('/journal/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, title, content, emotion_type, voice_input, created_at
       FROM journal_entries
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching journal entries:', err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

////////////////////////
////////resources
///////////////////////

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ chatId }) => {
    socket.join(chatId);
    console.log(`Joined room: ${chatId}`);
  });

  socket.on('send_resource', async (data) => {
    const { chatId, senderId, receiverId, content } = data;
    const messageId = uuidv4();

    try {
      await pool.query(
        'INSERT INTO resources (id, chat_id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4, $5)',
        [messageId, chatId, senderId, receiverId, content]
      );

      io.to(chatId).emit('receive_resource', {
        id: messageId,
        chatId,
        senderId,
        receiverId,
        content,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('DB error:', err);
    }
  });
});

app.get('/resources/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    const result = await pool.query(
      'SELECT sender_id, content, timestamp FROM resources WHERE chat_id = $1 ORDER BY timestamp ASC',
      [chatId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching resources');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
