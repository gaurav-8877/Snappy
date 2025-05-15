const {
  addMessage,
  getMessages,
  updateMessage,
  deleteMessage,
  markAsSeen
} = require("../controllers/messageController");
const router = require("express").Router();

router.post("/addmsg/", addMessage);
router.post("/getmsg/", getMessages);
router.put("/updatemsg/", updateMessage);
router.put("/deletemsg/:id", deleteMessage);
router.put("/markseen/:id", markAsSeen);

module.exports = router;
