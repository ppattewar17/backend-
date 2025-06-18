# backend-
## 📦 Features

- ✅ User & Doctor Authentication (JWT)
- ✅ User Profile Management
- 💬 Real-time Chat via Socket.IO
- 📚 Real-time Resource Sharing
- 📅 Appointment Booking & Status Updates
- 😴 Sleep Quality Tracking
- 📓 Journaling with Emotions & Prompts
- 🔐 Password Hashing (bcrypt)
- 🛡️ Secure REST APIs with Token-Based Auth (JWT)

-  REST API Endpoints
Auth
POST /register – User register

POST /login – User login

POST /doctor/register – Doctor register

POST /doctor/login – Doctor login

Profile
GET /api/users/:userId – Get user profile

PUT /api/users/:userId – Create or update profile

Chat
GET /messages/:chatId – Get chat history

Sleep & Expression
POST /sleep – Record sleep quality

POST /expression – Record user expression

Journal
POST /journal – Submit journal entry

GET /journal/:userId – Get all journal entries

Appointments
POST /appointments – Book an appointment

PUT /api/appointments/:id/status – Update appointment status

GET /api/appointments – List all appointments

Resources
GET /resources/:chatId – Get shared resources in a chat
