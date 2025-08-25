import { create } from "zustand";
import toast from "react-hot-toast";
import axios from "axios"; // Import axios for ML API calls
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  unreadMessages: {}, // ✅ Fixed: Now properly managed
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/api/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/api/messages/${userId}`);
      set({ messages: res.data });

      // ✅ Mark messages as read when fetching messages
      get().markMessagesAsRead(userId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { logout, authUser } = useAuthStore.getState();
  
    if (!authUser || !authUser._id) {
      console.error("❌ ERROR: authUser is missing or invalid!", authUser);
      toast.error("Authentication error. Please log in again.");
      return;
    }
  
    if (!selectedUser || !selectedUser._id) {
      toast.error("No user selected or invalid recipient!");
      return;
    }
  
    try {
      const userResponse = await axiosInstance.get(`/api/auth/user/${authUser._id}`);
      let { flagged, suspensionexpireat, banned } = userResponse.data;
  
      if (banned || flagged >= 5) {
        toast.error("⛔ You are permanently banned from sending messages.");
        if (typeof logout === "function") {
          await logout();
          console.log("✅ User logged out due to permanent ban.");
        } else {
          console.error("❌ Logout function is not available!");
          toast.error("Failed to log out. Please log out manually.");
        }
        return;
      }
  
      if (suspensionexpireat && suspensionexpireat !== "permanent" && new Date(suspensionexpireat) > new Date()) {
        toast.error("⏳ You are currently suspended. Try again later.");
        return;
      }
  
      if (flagged === null || flagged === undefined) {
        console.warn("⚠️ Flagged is null or undefined, defaulting to 0");
        flagged = 0;
      }
  
      const hasText = messageData.text && messageData.text.trim().length > 0;
      const hasImage = messageData.imageUrl && messageData.imageUrl.trim().length > 0;
  
      if (!hasText && !hasImage) {
        toast.error("Message cannot be empty!");
        return;
      }
  
      if (hasImage && !hasText) {
        console.log("🖼️ Only image detected, bypassing ML check...");
      } else if (hasText) {
        console.log("🔍 Sending text for harmful content check...");
        const checkResponse = await axios.post(
          "http://127.0.0.1:5002/predict",
          { message: messageData.text.trim() },
          { headers: { "Content-Type": "application/json" } }
        );
  
        console.log("✅ ML API Response:", checkResponse.data);
  
        if (!checkResponse.data || checkResponse.data.prediction === undefined) {
          console.error("🚨 ERROR: Invalid API response!", checkResponse);
          toast.error("Error verifying message content. Try again.");
          return;
        }
  
        if (checkResponse.data.prediction === 1) {
          console.warn("⚠️ Harmful message detected!");
          toast.error("⚠️ Message contains harmful content!");
  
          let newFlagged = flagged + 1;
          let suspensionTime = null;
          let banMessage = "";
  
          switch (newFlagged) {
            case 1:
              suspensionTime = 5 * 60 * 1000;
              banMessage = "You have been suspended for 5 minutes.";
              break;
            case 2:
              suspensionTime = 60 * 60 * 1000;
              banMessage = "You have been suspended for 1 hour.";
              break;
            case 3:
              suspensionTime = 5 * 60 * 60 * 1000;
              banMessage = "You have been suspended for 5 hours.";
              break;
            case 4:
              suspensionTime = 24 * 60 * 60 * 1000;
              banMessage = "You have been suspended for 24 hours.";
              break;
            case 5:
              suspensionTime = null;
              banMessage = "🚫 You have been permanently banned.";
              break;
            default:
              break;
          }
  
          try {
            console.log("🔄 Updating user suspension...");
            const response = await axiosInstance.put(`/api/auth/suspend/${authUser._id}`, {
              flagged: newFlagged,
              banned: newFlagged >= 5,
              suspensionexpireat: newFlagged >= 5 ? null : new Date(Date.now() + suspensionTime).toISOString(),
            });
  
            console.log("✅ Suspension response:", response.data);
  
            toast.error(banMessage);
  
            // Logout user after sending harmful content
            if (typeof logout === "function") {
              await logout();
              console.log("✅ User logged out due to harmful message.");
            } else {
              console.error("❌ Logout function is not available!");
              toast.error("Failed to log out. Please log out manually.");
            }
  
            return;
          } catch (err) {
            console.error("❌ Failed to suspend user:", err.response?.data || err.message);
            toast.error(
              err.response?.status === 404
                ? "Suspension endpoint not found. Contact support."
                : `Suspension failed: ${err.message}. Contact support.`
            );
            return;
          }
        }
      }
  
      console.log("✅ Message is safe, sending...");
      const res = await axiosInstance.post("/api/messages/send", {
        senderId: authUser._id,
        receiverId: selectedUser._id,
        text: messageData.text,
        image: messageData.imageUrl,
      });
  
      console.log("✅ Message sent:", res.data);
      set({ messages: [...messages, res.data.message] });
  
    } catch (error) {
      console.error("❌ Error in sendMessage:", error);
      toast.error("Error sending message. Try again.");
    }
  },
  


  subscribeToMessages: () => {
    const { selectedUser, unreadMessages } = get();
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.error("Socket is not initialized. Skipping subscription.");
      return;
    }
  
    socket.on("newMessage", (newMessage) => {
      console.log("Received new message via Socket.IO:", newMessage); // Debug
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser?._id;
  
      if (isMessageSentFromSelectedUser) {
        set((state) => ({
          messages: [...state.messages, newMessage], // Already correct
        }));
      } else {
        const senderId = newMessage.senderId;
        set((state) => ({
          unreadMessages: {
            ...state.unreadMessages,
            [senderId]: (state.unreadMessages[senderId] || 0) + 1,
          },
        }));
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
    if (selectedUser && selectedUser._id) {
      get().markMessagesAsRead(selectedUser._id);
    }
  },

  markMessagesAsRead: (userId) => {
    set((state) => ({
      unreadMessages: {
        ...state.unreadMessages,
        [userId]: 0,
      },
    }));
  },

  // ✅ Added function to clear unread messages
  clearUnreadMessages: (userId) => {
    set((state) => ({
      unreadMessages: {
        ...state.unreadMessages,
        [userId]: 0,
      },
    }));
  },
}));
