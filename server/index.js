const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const app = express();
const socket = require("socket.io");
require("dotenv").config();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connetion Successfull");
  })
  .catch((err) => {
    console.log(err.message);
  });

app.get("/ping", (_req, res) => {
  return res.json({ msg: "Ping Successful" });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on ${process.env.PORT}`)
);
const io = socket(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    credentials: true,
  },
});

global.onlineUsers = new Map();
io.on("connection", (socket) => {
  global.chatSocket = socket;

  console.log("New socket connection:", socket.id);

  socket.on("add-user", (userId) => {
    console.log("User connected:", userId, "Socket ID:", socket.id);
    onlineUsers.set(userId, socket.id);
    console.log("Current online users:", Array.from(onlineUsers.entries()));
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    // Remove the disconnected user from the online users map
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        console.log("Removing user from online users:", userId);
        onlineUsers.delete(userId);
        break;
      }
    }

    console.log("Current online users after disconnect:", Array.from(onlineUsers.entries()));
  });

  socket.on("send-msg", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("msg-recieve", {
        message: data.msg,
        id: data.id,
        from: data.from
      });
    }
  });

  socket.on("message-edited", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("message-edited", {
        id: data.id,
        message: data.message
      });
    }
  });

  socket.on("message-deleted", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("message-deleted", {
        id: data.id
      });
    }
  });

  socket.on("message-seen", (data) => {
    console.log("Message seen event received:", data);
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      console.log("Emitting message-seen event to socket:", sendUserSocket);
      socket.to(sendUserSocket).emit("message-seen", {
        id: data.id
      });
    } else {
      console.log("User socket not found for user:", data.to);
      console.log("Current online users:", Array.from(onlineUsers.entries()));
    }
  });
});
