const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Add your PostgreSQL connection string before starting the server.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  family: 4,
  ssl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

function convertQuery(query) {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`)
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
}

function normalizeRow(row) {
  if (!row) return row;

  const keyMap = {
    displayname: 'displayName',
    createdat: 'createdAt',
    updatedat: 'updatedAt',
    conversationid: 'conversationId',
    employeeName: 'employeeName',
    employeename: 'employeeName',
    ticketid: 'ticketId',
    sendername: 'senderName',
    senderrole: 'senderRole',
    lastreadmessageid: 'lastReadMessageId'
  };

  return Object.fromEntries(Object.entries(row).map(([key, value]) => [keyMap[key] || key, value]));
}

const db = {
  serialize(callback) {
    callback();
  },
  run(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const isInsert = /^\s*INSERT\s+INTO\s+(users|incidents|messages|conversations)\b/i.test(query)
      && !/RETURNING\s/i.test(query);
    const sql = convertQuery(query) + (isInsert ? ' RETURNING id' : '');
    pool.query(sql, params)
      .then((result) => {
        if (callback) {
          callback.call({
            lastID: result.rows[0]?.id,
            changes: result.rowCount
          }, null);
        }
      })
      .catch((error) => callback?.call({}, error));
  },
  get(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(convertQuery(query), params)
      .then((result) => callback(null, normalizeRow(result.rows[0])))
      .catch((error) => callback(error));
  },
  all(query, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(convertQuery(query), params)
      .then((result) => callback(null, result.rows.map(normalizeRow)))
      .catch((error) => callback(error));
  }
};

app.use(express.json());
app.use(express.static(__dirname));

const defaultUsers = [
  {
    username: 'employee',
    email: 'employee@bankit.com',
    password: 'employee123',
    role: 'Employee',
    displayName: 'Employee User'
  },
  {
    username: 'admin',
    email: 'admin@bankit.com',
    password: 'admin123',
    role: 'Admin',
    displayName: 'System Admin'
  },
  {
    username: 'itofficer',
    email: 'itofficer@bankit.com',
    password: 'itofficer123',
    role: 'IT Officer',
    displayName: 'IT Officer'
  }
];

async function seedDefaultUsers() {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (result.rows[0].count > 0) return;

  for (const user of defaultUsers) {
    await pool.query(
      'INSERT INTO users (username, email, password, role, "displayName") VALUES ($1, $2, $3, $4, $5)',
      [user.username, user.email, user.password, user.role, user.displayName]
    );
  }
}

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        "displayName" TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        branch TEXT NOT NULL,
        department TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        requester TEXT NOT NULL,
        category TEXT NOT NULL,
        details TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversationId INTEGER,
        senderName TEXT NOT NULL,
        senderRole TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        employeeName TEXT NOT NULL,
        ticketId INTEGER,
        subject TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_reads (
        conversationId INTEGER NOT NULL,
        userName TEXT NOT NULL,
        lastReadMessageId INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (conversationId, userName)
      )
    `);

    await seedDefaultUsers();
    console.log('PostgreSQL database initialized.');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

app.post('/api/login', (req, res) => {
  const emailOrUsername = String(req.body?.emailOrUsername || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!emailOrUsername || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const normalizedInput = emailOrUsername.toLowerCase();

  db.get(
    'SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
    [normalizedInput, normalizedInput],
    (err, user) => {
      if (err) {
        console.error('Login query failed:', err);
        return res.status(500).json({ success: false, message: 'Database error.' });
      }

      if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          displayName: user.displayName
        }
      });
    }
  );
});

app.get('/api/incidents', (req, res) => {
  db.all('SELECT * FROM incidents ORDER BY id DESC', (err, rows) => {
    if (err) {
      console.error('Incident fetch failed:', err);
      return res.status(500).json({ success: false, message: 'Unable to fetch incidents.' });
    }

    return res.json({ success: true, incidents: rows });
  });
});

app.get('/api/messages', (req, res) => {
  const currentRole = String(req.query.currentRole || '');

  if (!['Employee', 'IT Officer', 'Admin'].includes(currentRole)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to view chat messages.' });
  }

  db.all('SELECT * FROM messages ORDER BY id ASC', (err, rows) => {
    if (err) {
      console.error('Message fetch failed:', err);
      return res.status(500).json({ success: false, message: 'Unable to fetch chat messages.' });
    }

    return res.json({ success: true, messages: rows });
  });
});

app.get('/api/conversations', (req, res) => {
  const currentRole = String(req.query.currentRole || '');
  const currentUserName = String(req.query.userName || '').trim();

  if (!['IT Officer', 'Admin'].includes(currentRole) || !currentUserName) {
    return res.status(403).json({ success: false, message: 'Only IT staff can view conversations.' });
  }

  db.all(
    `SELECT c.id, c.employeeName, c.ticketId, c.subject, c.createdAt, c.updatedAt,
      (SELECT message FROM messages WHERE conversationId = c.id ORDER BY id DESC LIMIT 1) AS lastMessage,
      (SELECT COUNT(*) FROM messages m
       WHERE m.conversationId = c.id AND m.senderRole = 'Employee'
       AND m.id > COALESCE((SELECT lastReadMessageId FROM conversation_reads cr
         WHERE cr.conversationId = c.id AND cr.userName = ?), 0)) AS unreadCount
     FROM conversations c ORDER BY c.updatedAt DESC, c.id DESC`,
    [currentUserName],
    (err, rows) => {
      if (err) {
        console.error('Conversation fetch failed:', err);
        return res.status(500).json({ success: false, message: 'Unable to fetch conversations.' });
      }

      return res.json({ success: true, conversations: rows });
    }
  );
});

app.post('/api/conversations/:id/read', (req, res) => {
  const { currentRole, userName } = req.body || {};
  const conversationId = Number(req.params.id);

  if (!['IT Officer', 'Admin'].includes(currentRole) || !userName || !conversationId) {
    return res.status(403).json({ success: false, message: 'Only IT staff can mark conversations read.' });
  }

  db.get(
    'SELECT MAX(id) AS lastMessageId FROM messages WHERE conversationId = ?',
    [conversationId],
    (messageError, row) => {
      if (messageError) {
        return res.status(500).json({ success: false, message: 'Unable to mark conversation read.' });
      }

      db.run(
        `INSERT INTO conversation_reads (conversationId, userName, lastReadMessageId)
         VALUES (?, ?, ?)
         ON CONFLICT(conversationId, userName) DO UPDATE SET lastReadMessageId = excluded.lastReadMessageId`,
        [conversationId, String(userName).trim(), row.lastMessageId || 0],
        (readError) => {
          if (readError) {
            return res.status(500).json({ success: false, message: 'Unable to mark conversation read.' });
          }

          return res.json({ success: true });
        }
      );
    }
  );
});

app.post('/api/conversations', (req, res) => {
  const { currentRole, employeeName, ticketId, subject, message } = req.body || {};
  const selectedTicketId = Number(ticketId);
  const cleanSubject = String(subject || 'Support request').trim();
  const cleanMessage = String(message || '').trim();

  if (currentRole !== 'Employee') {
    return res.status(403).json({ success: false, message: 'Only employees can start conversations.' });
  }

  if (!employeeName || !cleanMessage || !selectedTicketId) {
    return res.status(400).json({ success: false, message: 'Select an active ticket and enter a message.' });
  }

  db.get(
    "SELECT id FROM incidents WHERE id = ? AND requester = ? AND status != 'Resolved'",
    [selectedTicketId, String(employeeName).trim()],
    (ticketError, ticket) => {
      if (ticketError) {
        return res.status(500).json({ success: false, message: 'Unable to verify the selected ticket.' });
      }

      if (!ticket) {
        return res.status(400).json({ success: false, message: 'Only your active tickets can start a conversation.' });
      }

      db.serialize(() => {
        db.run(
          'INSERT INTO conversations (employeeName, ticketId, subject) VALUES (?, ?, ?)',
          [String(employeeName).trim(), selectedTicketId, cleanSubject],
      function onConversation(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to start conversation.' });
        }

        const conversationId = this.lastID;
        db.run(
          'INSERT INTO messages (conversationId, senderName, senderRole, message) VALUES (?, ?, ?, ?)',
          [conversationId, String(employeeName).trim(), currentRole, cleanMessage],
          (messageError) => {
            if (messageError) {
              return res.status(500).json({ success: false, message: 'Failed to save first message.' });
            }

            return res.status(201).json({ success: true, conversationId });
          }
        );
      });
    });
    }
  );
});

app.get('/api/conversations/:id/messages', (req, res) => {
  const currentRole = String(req.query.currentRole || '');
  const conversationId = Number(req.params.id);

  if (!['Employee', 'IT Officer', 'Admin'].includes(currentRole) || !conversationId) {
    return res.status(403).json({ success: false, message: 'You are not allowed to view this conversation.' });
  }

  db.all(
    'SELECT * FROM messages WHERE conversationId = ? ORDER BY id ASC',
    [conversationId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Unable to fetch conversation messages.' });
      }

      return res.json({ success: true, messages: rows });
    }
  );
});

app.post('/api/conversations/:id/messages', (req, res) => {
  const { currentRole, senderName, message } = req.body || {};
  const conversationId = Number(req.params.id);
  const cleanMessage = String(message || '').trim();

  if (!['Employee', 'IT Officer', 'Admin'].includes(currentRole) || !conversationId) {
    return res.status(403).json({ success: false, message: 'You are not allowed to reply to this conversation.' });
  }

  if (!senderName || !cleanMessage) {
    return res.status(400).json({ success: false, message: 'A message is required.' });
  }

  db.run(
    'INSERT INTO messages (conversationId, senderName, senderRole, message) VALUES (?, ?, ?, ?)',
    [conversationId, String(senderName).trim(), currentRole, cleanMessage],
    function onInsert(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to send reply.' });
      }

      db.run('UPDATE conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);
      return res.status(201).json({ success: true, messageId: this.lastID });
    }
  );
});

app.post('/api/messages', (req, res) => {
  const { currentRole, senderName, message } = req.body || {};
  const cleanMessage = String(message || '').trim();

  if (!['Employee', 'IT Officer', 'Admin'].includes(currentRole)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to send chat messages.' });
  }

  if (!senderName || !cleanMessage) {
    return res.status(400).json({ success: false, message: 'A message is required.' });
  }

  db.run(
    'INSERT INTO messages (senderName, senderRole, message) VALUES (?, ?, ?)',
    [String(senderName).trim(), currentRole, cleanMessage],
    function onInsert(err) {
      if (err) {
        console.error('Message creation failed:', err);
        return res.status(500).json({ success: false, message: 'Failed to send message.' });
      }

      return res.status(201).json({ success: true, messageId: this.lastID });
    }
  );
});

app.get('/api/summary', (req, res) => {
  db.get(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN status != 'Resolved' THEN 1 ELSE 0 END) AS open
    FROM incidents`,
    (err, summary) => {
      if (err) {
        console.error('Summary query failed:', err);
        return res.status(500).json({ success: false, message: 'Unable to fetch support summary.' });
      }

      return res.json({
        success: true,
        summary: {
          total: summary.total || 0,
          resolved: summary.resolved || 0,
          open: summary.open || 0
        }
      });
    }
  );
});

app.get('/api/users', (req, res) => {
  if (req.query.currentRole !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Only the admin can view user accounts.' });
  }

  db.all(
    'SELECT id, username, email, role, "displayName" FROM users ORDER BY id ASC',
    (err, rows) => {
      if (err) {
        console.error('User list query failed:', err);
        return res.status(500).json({ success: false, message: 'Unable to fetch user accounts.' });
      }

      return res.json({ success: true, users: rows });
    }
  );
});

app.post('/api/incidents', (req, res) => {
  const { title, branch, department, priority, status, requester, category, details } = req.body || {};

  if (!title || !branch || !department || !priority || !requester || !details) {
    return res.status(400).json({ success: false, message: 'Please complete all required fields.' });
  }

  const query = `
    INSERT INTO incidents (title, branch, department, priority, status, requester, category, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [title.trim(), branch.trim(), department, priority, status || 'Open', requester.trim(), category || 'General', details.trim()],
    function onInsert(err) {
      if (err) {
        console.error('Incident creation failed:', err);
        return res.status(500).json({ success: false, message: 'Failed to save incident.' });
      }

      return res.status(201).json({
        success: true,
        incident: {
          id: this.lastID,
          title: title.trim(),
          branch: branch.trim(),
          department,
          priority,
          status: status || 'Open',
          requester: requester.trim(),
          category: category || 'General',
          details: details.trim()
        }
      });
    }
  );
});

app.patch('/api/incidents/:id', (req, res) => {
  const incidentId = Number(req.params.id);
  const { currentRole, status } = req.body || {};

  if (!['Admin', 'IT Officer'].includes(currentRole)) {
    return res.status(403).json({ success: false, message: 'Only Admin or IT Officer users can manage tickets.' });
  }

  if (!incidentId || !['Open', 'In Progress', 'Pending', 'Resolved'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Incident id and status are required.' });
  }

  db.run(
    'UPDATE incidents SET status = ? WHERE id = ?',
    [status, incidentId],
    function onUpdate(err) {
      if (err) {
        console.error('Incident update failed:', err);
        return res.status(500).json({ success: false, message: 'Unable to update incident.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Incident not found.' });
      }

      return res.json({ success: true, message: 'Incident updated.' });
    }
  );
});

app.post('/api/users', (req, res) => {
  const { currentRole, role, fullName, email, username, password } = req.body || {};

  if (currentRole !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Only the admin can create user accounts.' });
  }

  if (!fullName || !email || !username || !password) {
    return res.status(400).json({ success: false, message: 'All account fields are required.' });
  }

  if (!['Employee', 'IT Officer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Account type must be Employee or IT Officer.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim().toLowerCase();

  db.get(
    'SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
    [normalizedEmail, normalizedUsername],
    (err, existingUser) => {
      if (err) {
        console.error('Officer lookup failed:', err);
        return res.status(500).json({ success: false, message: 'Database lookup failed.' });
      }

      if (existingUser) {
        return res.status(409).json({ success: false, message: 'That email or username already exists.' });
      }

      db.run(
        'INSERT INTO users (username, email, password, role, "displayName") VALUES (?, ?, ?, ?, ?)',
        [username.trim(), normalizedEmail, password.trim(), role, fullName.trim()],
        function onInsert(err2) {
          if (err2) {
            console.error('Officer creation failed:', err2);
            return res.status(500).json({ success: false, message: 'Failed to create account.' });
          }

          return res.status(201).json({ success: true, message: `${role} account created successfully.` });
        }
      );
    }
  );
});

app.patch('/api/users/:id', (req, res) => {
  const { currentRole, role } = req.body || {};
  const userId = Number(req.params.id);

  if (currentRole !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Only the admin can update user accounts.' });
  }

  if (!userId || !['Employee', 'IT Officer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'A valid account role is required.' });
  }

  db.run(
    'UPDATE users SET role = ? WHERE id = ? AND role != \'Admin\'',
    [role, userId],
    function onUpdate(err) {
      if (err) {
        console.error('User role update failed:', err);
        return res.status(500).json({ success: false, message: 'Unable to update account role.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Account not found or cannot be changed.' });
      }

      return res.json({ success: true, message: 'Account role updated.' });
    }
  );
});

app.delete('/api/users/:id', (req, res) => {
  const currentRole = req.body?.currentRole || req.query.currentRole;
  const userId = Number(req.params.id);

  if (currentRole !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Only the admin can delete user accounts.' });
  }

  if (!userId) {
    return res.status(400).json({ success: false, message: 'A valid account id is required.' });
  }

  db.run(
    'DELETE FROM users WHERE id = ? AND role != \'Admin\'',
    [userId],
    function onDelete(err) {
      if (err) {
        console.error('User deletion failed:', err);
        return res.status(500).json({ success: false, message: 'Unable to delete account.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Account not found or cannot be deleted.' });
      }

      return res.json({ success: true, message: 'Account deleted.' });
    }
  );
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Bank IT portal running on http://localhost:${port}`);
  });
});
