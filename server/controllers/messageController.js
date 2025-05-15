const Messages = require("../models/messageModel");

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    const messages = await Messages.find({
      users: {
        $all: [from, to],
      },
    }).sort({ updatedAt: 1 });

    // Mark messages as seen
    const updatedMessages = await Messages.find({
      users: {
        $all: [from, to],
      },
      sender: to, // Only mark messages from the other user as seen
      seen: false,
    });

    if (updatedMessages.length > 0) {
      // Update the seen status
      await Messages.updateMany(
        {
          users: {
            $all: [from, to],
          },
          sender: to,
          seen: false,
        },
        { $set: { seen: true } }
      );

      // Return the IDs of messages that were marked as seen
      const seenMessageIds = updatedMessages.map(msg => msg._id);
      res.locals.seenMessageIds = seenMessageIds;
    }

    const projectedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === from,
        message: msg.message.text,
        id: msg._id,
        seen: msg.seen,
        isEdited: msg.isEdited,
        isDeleted: msg.isDeleted,
        createdAt: msg.createdAt,
      };
    });
    // Include the seen message IDs in the response
    if (res.locals.seenMessageIds && res.locals.seenMessageIds.length > 0) {
      res.json({
        messages: projectedMessages,
        seenMessageIds: res.locals.seenMessageIds
      });
    } else {
      res.json({
        messages: projectedMessages,
        seenMessageIds: []
      });
    }
  } catch (ex) {
    next(ex);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message } = req.body;
    const data = await Messages.create({
      message: { text: message },
      users: [from, to],
      sender: from,
      seen: false,
    });

    if (data) return res.json({ msg: "Message added successfully.", id: data._id });
    else return res.json({ msg: "Failed to add message to the database" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.updateMessage = async (req, res, next) => {
  try {
    const { id, message } = req.body;
    const data = await Messages.findByIdAndUpdate(
      id,
      {
        "message.text": message,
        isEdited: true,
      },
      { new: true }
    );

    if (data) return res.json({ msg: "Message updated successfully." });
    else return res.json({ msg: "Failed to update message" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await Messages.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        "message.text": "This message was deleted",
      },
      { new: true }
    );

    if (data) return res.json({ msg: "Message deleted successfully." });
    else return res.json({ msg: "Failed to delete message" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.markAsSeen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await Messages.findByIdAndUpdate(
      id,
      { seen: true },
      { new: true }
    );

    if (data) return res.json({ msg: "Message marked as seen." });
    else return res.json({ msg: "Failed to mark message as seen" });
  } catch (ex) {
    next(ex);
  }
};
