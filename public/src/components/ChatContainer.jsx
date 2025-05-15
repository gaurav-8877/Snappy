import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import Logout from "./Logout";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import {
  sendMessageRoute,
  recieveMessageRoute,
  updateMessageRoute,
  deleteMessageRoute
} from "../utils/APIRoutes";
import { FaCheck, FaCheckDouble, FaEdit, FaTrash } from "react-icons/fa";

export default function ChatContainer({ currentChat, socket }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    messageId: null
  });

  useEffect(async () => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
    const response = await axios.post(recieveMessageRoute, {
      from: data._id,
      to: currentChat._id,
    });

    // Handle the new response format
    if (response.data.messages) {
      setMessages(response.data.messages);

      // If any messages were marked as seen, notify the sender
      if (response.data.seenMessageIds && response.data.seenMessageIds.length > 0) {
        response.data.seenMessageIds.forEach(id => {
          socket.current.emit("message-seen", {
            to: currentChat._id,
            from: data._id,
            id: id,
          });
        });
      }
    } else {
      // Fallback for backward compatibility
      setMessages(response.data);
    }
  }, [currentChat]);

  useEffect(() => {
    const getCurrentChat = async () => {
      if (currentChat) {
        await JSON.parse(
          localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
        )._id;
      }
    };
    getCurrentChat();
  }, [currentChat]);

  const handleSendMsg = async (msg) => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
    const response = await axios.post(sendMessageRoute, {
      from: data._id,
      to: currentChat._id,
      message: msg,
    });

    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: data._id,
      msg,
      id: response.data.id,
    });

    const msgs = [...messages];
    msgs.push({
      fromSelf: true,
      message: msg,
      id: response.data.id,
      seen: false,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
    });
    setMessages(msgs);
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditText(message.message);
    setShowOptions(null);
  };

  const handleDeleteMessage = async (id) => {
    try {
      await axios.put(`${deleteMessageRoute}/${id}`);

      // Update the message in the UI
      setMessages(
        messages.map((msg) => {
          if (msg.id === id) {
            return { ...msg, isDeleted: true, message: "This message was deleted" };
          }
          return msg;
        })
      );

      // Notify the other user about the deletion
      const data = await JSON.parse(
        localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
      );
      socket.current.emit("message-deleted", {
        to: currentChat._id,
        from: data._id,
        id,
      });

      setShowOptions(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleUpdateMessage = async () => {
    if (!editingMessage || editText.trim() === "") return;

    try {
      await axios.put(updateMessageRoute, {
        id: editingMessage.id,
        message: editText,
      });

      // Update the message in the UI
      setMessages(
        messages.map((msg) => {
          if (msg.id === editingMessage.id) {
            return { ...msg, message: editText, isEdited: true };
          }
          return msg;
        })
      );

      // Notify the other user about the edit
      const data = await JSON.parse(
        localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
      );
      socket.current.emit("message-edited", {
        to: currentChat._id,
        from: data._id,
        id: editingMessage.id,
        message: editText,
      });

      setEditingMessage(null);
      setEditText("");
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  const handleContextMenu = (e, message) => {
    // Only allow context menu for user's own messages that aren't deleted
    if (message.fromSelf && !message.isDeleted) {
      e.preventDefault();
      setContextMenu({
        show: true,
        x: e.pageX,
        y: e.pageY,
        messageId: message.id
      });
    }
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("msg-recieve", (msg) => {
        setArrivalMessage({
          fromSelf: false,
          message: msg.message,
          id: msg.id,
          from: msg.from,
          seen: false,
          isEdited: false,
          isDeleted: false,
          createdAt: new Date(),
        });
      });

      socket.current.on("message-edited", ({ id, message }) => {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === id) {
              return { ...msg, message, isEdited: true };
            }
            return msg;
          })
        );
      });

      socket.current.on("message-deleted", ({ id }) => {
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === id) {
              return { ...msg, isDeleted: true, message: "This message was deleted" };
            }
            return msg;
          })
        );
      });

      socket.current.on("message-seen", ({ id }) => {
        console.log("Message seen event received for id:", id);
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === id) {
              console.log("Updating message seen status:", msg);
              return { ...msg, seen: true };
            }
            return msg;
          })
        );
      });
    }

    return () => {
      if (socket.current) {
        socket.current.off("msg-recieve");
        socket.current.off("message-edited");
        socket.current.off("message-deleted");
        socket.current.off("message-seen");
      }
    };
  }, []);

  useEffect(() => {
    if (arrivalMessage) {
      // When a new message arrives, add it to the messages array
      setMessages((prev) => [...prev, arrivalMessage]);

      // Mark the message as seen and notify the sender
      const markMessageAsSeen = async () => {
        try {
          const data = await JSON.parse(
            localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
          );

          // Emit the message-seen event to notify the sender
          socket.current.emit("message-seen", {
            to: arrivalMessage.from,
            from: data._id,
            id: arrivalMessage.id,
          });
        } catch (error) {
          console.error("Error marking message as seen:", error);
        }
      };

      markMessageAsSeen();
    }
  }, [arrivalMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add event listener for clicks to close the context menu
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(prev => ({
        ...prev,
        show: false
      }));
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <div className="avatar">
            <img
              src={`data:image/svg+xml;base64,${currentChat.avatarImage}`}
              alt=""
            />
          </div>
          <div className="username">
            <h3>{currentChat.username}</h3>
          </div>
        </div>
        <Logout />
      </div>
      <div className="chat-messages">
        {editingMessage ? (
          <div className="edit-message-container">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="edit-input"
            />
            <div className="edit-buttons">
              <button onClick={handleUpdateMessage} className="save-btn">Save</button>
              <button onClick={() => setEditingMessage(null)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          return (
            <div ref={scrollRef} key={message.id || uuidv4()}>
              <div
                className={`message ${
                  message.fromSelf ? "sended" : "recieved"
                }`}
                onContextMenu={(e) => handleContextMenu(e, message)}
              >
                <div
                  className="content"
                  title={message.fromSelf && !message.isDeleted ? "Right-click for options" : ""}
                >
                  <p className={message.isDeleted ? "deleted-message" : ""}>
                    {message.message}
                    {message.isEdited && !message.isDeleted && (
                      <span className="edited-indicator"> (edited)</span>
                    )}
                  </p>

                  {message.fromSelf && !message.isDeleted && (
                    <div className="message-options">
                      <div className="message-status">
                        {message.seen ? (
                          <FaCheckDouble className="seen-icon" title="Seen" />
                        ) : (
                          <FaCheck className="sent-icon" title="Sent" />
                        )}
                        <span className="status-text">{message.seen ? "Seen" : "Sent"}</span>
                      </div>
                    </div>
                  )}

                  {!message.fromSelf && (
                    <div className="message-time">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ChatInput handleSendMsg={handleSendMsg} />

      {/* Context Menu */}
      {contextMenu.show && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="context-option"
            onClick={() => {
              const message = messages.find(msg => msg.id === contextMenu.messageId);
              if (message) {
                handleEditMessage(message);
              }
              setContextMenu({...contextMenu, show: false});
            }}
          >
            <FaEdit /> Edit
          </div>
          <div
            className="context-option"
            onClick={() => {
              handleDeleteMessage(contextMenu.messageId);
              setContextMenu({...contextMenu, show: false});
            }}
          >
            <FaTrash /> Delete
          </div>
        </ContextMenu>
      )}
    </Container>
  );
}

const ContextMenu = styled.div`
  position: fixed;
  z-index: 100;
  background-color: #0d0d30;
  border-radius: 0.5rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  width: 150px;
  left: ${props => props.x}px;
  top: ${props => props.y}px;

  .context-option {
    padding: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #d1d1d1;

    &:hover {
      background-color: #ffffff10;
    }

    svg {
      font-size: 0.9rem;
    }

    &:first-child {
      border-top-left-radius: 0.5rem;
      border-top-right-radius: 0.5rem;
    }

    &:last-child {
      border-bottom-left-radius: 0.5rem;
      border-bottom-right-radius: 0.5rem;
    }
  }
`;

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    grid-template-rows: 15% 70% 15%;
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      .avatar {
        img {
          height: 3rem;
        }
      }
      .username {
        h3 {
          color: white;
        }
      }
    }
  }
  .chat-messages {
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }

    .edit-message-container {
      background-color: #0d0d30;
      padding: 1rem;
      border-radius: 1rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .edit-input {
        background-color: #ffffff10;
        color: white;
        border: none;
        padding: 0.5rem;
        border-radius: 0.5rem;
        font-size: 0.9rem;
        width: 100%;
        &:focus {
          outline: none;
          border: 1px solid #4e0eff;
        }
      }

      .edit-buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;

        button {
          padding: 0.3rem 0.8rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
          font-size: 0.8rem;

          &.save-btn {
            background-color: #4e0eff;
            color: white;
          }

          &.cancel-btn {
            background-color: #ffffff20;
            color: white;
          }
        }
      }
    }

    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 0.9rem;
        border-radius: 1rem;
        color: #d1d1d1;
        position: relative;

        p {
          margin-bottom: 0.3rem;

          &.deleted-message {
            font-style: italic;
            color: #ffffff80;
          }

          .edited-indicator {
            font-size: 0.7rem;
            color: #ffffff80;
            font-style: italic;
          }
        }

        .message-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.3rem;

          .message-status {
            display: flex;
            align-items: center;
            gap: 0.3rem;

            .seen-icon {
              color: #4e0eff;
              font-size: 0.7rem;
            }

            .sent-icon {
              color: #ffffff80;
              font-size: 0.7rem;
            }

            .status-text {
              font-size: 0.7rem;
              color: #ffffff80;
            }
          }


        }

        .message-time {
          font-size: 0.7rem;
          color: #ffffff80;
          margin-top: 0.3rem;
          text-align: right;
        }

        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 70%;
        }
      }
    }
    .sended {
      justify-content: flex-end;
      .content {
        background-color: #4f04ff21;
        cursor: context-menu; /* Indicate right-click is available */
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background-color: #9900ff20;
      }
    }
  }
`;
