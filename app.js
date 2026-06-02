import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getAuth,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const state = {
  authMode: "login",
  currentUser: null,
  currentProfile: null,
  activeFriend: null,
  friends: new Map(),
  unreadCounts: new Map(),
  unsubscribers: [],
};

const selectors = {
  appShell: document.querySelector("#appShell"),
  authView: document.querySelector("#authView"),
  dashboardView: document.querySelector("#dashboardView"),
  loginTab: document.querySelector("#loginTab"),
  signupTab: document.querySelector("#signupTab"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  authSubtitle: document.querySelector("#authSubtitle"),
  authSubmit: document.querySelector("#authSubmit"),
  authStatus: document.querySelector("#authStatus"),
  signupFields: document.querySelectorAll(".signup-only"),
  displayName: document.querySelector("#displayName"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  logoutButton: document.querySelector("#logoutButton"),
  themeToggle: document.querySelector("#themeToggle"),
  mobileNavToggle: document.querySelector("#mobileNavToggle"),
  sidebar: document.querySelector("#sidebar"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileName: document.querySelector("#profileName"),
  profileEmail: document.querySelector("#profileEmail"),
  profileStatus: document.querySelector("#profileStatus"),
  photoUpload: document.querySelector("#photoUpload"),
  friendSearch: document.querySelector("#friendSearch"),
  searchResults: document.querySelector("#searchResults"),
  friendList: document.querySelector("#friendList"),
  personTemplate: document.querySelector("#personTemplate"),
  emptyChat: document.querySelector("#emptyChat"),
  chatRoom: document.querySelector("#chatRoom"),
  closeChatButton: document.querySelector("#closeChatButton"),
  chatFriendAvatar: document.querySelector("#chatFriendAvatar"),
  chatFriendName: document.querySelector("#chatFriendName"),
  chatFriendStatus: document.querySelector("#chatFriendStatus"),
  messageList: document.querySelector("#messageList"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
};

function avatarFor(name = "Knowledge Person") {
  const label = encodeURIComponent(name.trim() || "KP");
  return `https://api.dicebear.com/8.x/initials/svg?seed=${label}&backgroundColor=0755ff,030712&fontWeight=700&fontFamily=Arial`;
}

function setStatus(element, message = "", type = "") {
  element.textContent = message;
  element.className = `form-status ${type}`.trim();
}

function generateSearchTokens(...values) {
  const tokens = new Set();

  values
    .filter(Boolean)
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9@.]+/))
    .filter(Boolean)
    .forEach((word) => {
      for (let i = 1; i <= word.length; i += 1) {
        tokens.add(word.slice(0, i));
      }
    });

  return Array.from(tokens).slice(0, 500);
}

function conversationIdFor(userId, friendId) {
  return [userId, friendId].sort().join("_");
}

function formatTime(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

async function ensureNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") {
    return;
  }

  try {
    await Notification.requestPermission();
  } catch (error) {
    console.warn("Notification permission request failed", error);
  }
}

function notifyForMessage(friend, text) {
  if (!("Notification" in window) || Notification.permission !== "granted" || document.hasFocus()) {
    return;
  }

  new Notification(`New message from ${friend.displayName}`, {
    body: text,
    icon: friend.photoURL || avatarFor(friend.displayName),
  });
}

async function createOrUpdateUserProfile(user, displayName) {
  const name = displayName || user.displayName || user.email.split("@")[0];
  const photoURL = user.photoURL || avatarFor(name);
  const profile = {
    uid: user.uid,
    displayName: name,
    displayNameLower: name.toLowerCase(),
    email: user.email,
    emailLower: user.email.toLowerCase(),
    photoURL,
    searchTokens: generateSearchTokens(name, user.email),
    isOnline: true,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", user.uid), profile, { merge: true });
  return profile;
}

function renderShell(isAuthenticated) {
  selectors.authView.classList.toggle("hidden", isAuthenticated);
  selectors.dashboardView.classList.toggle("hidden", !isAuthenticated);
  selectors.logoutButton.classList.toggle("hidden", !isAuthenticated);
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isSignup = mode === "signup";

  selectors.loginTab.classList.toggle("active", !isSignup);
  selectors.signupTab.classList.toggle("active", isSignup);
  selectors.loginTab.setAttribute("aria-selected", String(!isSignup));
  selectors.signupTab.setAttribute("aria-selected", String(isSignup));
  selectors.signupFields.forEach((field) => field.classList.toggle("hidden", !isSignup));
  selectors.displayName.toggleAttribute("required", isSignup);
  selectors.password.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  selectors.authTitle.textContent = isSignup ? "Create your account" : "Welcome back";
  selectors.authSubtitle.textContent = isSignup
    ? "Join Knowledge People and begin connecting today."
    : "Log in to continue your conversations.";
  selectors.authSubmit.textContent = isSignup ? "Sign Up" : "Login";
  setStatus(selectors.authStatus);
}

function clearSubscriptions() {
  state.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
}

function renderProfile(profile) {
  selectors.profileAvatar.src = profile.photoURL || avatarFor(profile.displayName);
  selectors.profileName.textContent = profile.displayName;
  selectors.profileEmail.textContent = profile.email;
}

function createPersonRow(person, buttonLabel, buttonAction, options = {}) {
  const row = selectors.personTemplate.content.firstElementChild.cloneNode(true);
  const avatar = row.querySelector(".person-avatar");
  const name = row.querySelector("strong");
  const meta = row.querySelector("small");
  const button = row.querySelector("button");

  avatar.src = person.photoURL || avatarFor(person.displayName);
  avatar.alt = `${person.displayName} profile picture`;
  name.textContent = person.displayName;
  meta.textContent = options.meta || person.email || (person.isOnline ? "Online" : "Offline");
  button.textContent = buttonLabel;
  button.addEventListener("click", buttonAction);

  if (options.active) {
    row.classList.add("active");
  }

  if (options.unreadCount) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = options.unreadCount > 9 ? "9+" : options.unreadCount;
    name.append(badge);
  }

  return row;
}

function renderFriends() {
  selectors.friendList.innerHTML = "";
  const friends = Array.from(state.friends.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (!friends.length) {
    selectors.friendList.innerHTML = '<p class="form-status">Add friends to start private conversations.</p>';
    return;
  }

  friends.forEach((friend) => {
    selectors.friendList.append(
      createPersonRow(friend, "Chat", () => openChat(friend), {
        active: state.activeFriend?.uid === friend.uid,
        meta: friend.isOnline ? "Online now" : `Offline${friend.lastSeen?.toDate ? ` · Last seen ${friend.lastSeen.toDate().toLocaleDateString()}` : ""}`,
        unreadCount: state.unreadCounts.get(friend.uid) || 0,
      }),
    );
  });
}

async function addFriend(friend) {
  if (!state.currentUser || friend.uid === state.currentUser.uid) {
    return;
  }

  const currentFriendRef = doc(db, "users", state.currentUser.uid, "friends", friend.uid);
  const otherFriendRef = doc(db, "users", friend.uid, "friends", state.currentUser.uid);
  const batch = writeBatch(db);
  const currentSnapshot = {
    uid: friend.uid,
    createdAt: serverTimestamp(),
  };
  const otherSnapshot = {
    uid: state.currentUser.uid,
    createdAt: serverTimestamp(),
  };

  batch.set(currentFriendRef, currentSnapshot, { merge: true });
  batch.set(otherFriendRef, otherSnapshot, { merge: true });
  await batch.commit();
  setStatus(selectors.profileStatus, `${friend.displayName} is now your friend.`, "success");
}

async function searchFriends(term) {
  selectors.searchResults.innerHTML = "";
  const normalized = term.trim().toLowerCase();

  if (normalized.length < 2 || !state.currentUser) {
    selectors.searchResults.innerHTML = '<p class="form-status">Type at least 2 characters to search.</p>';
    return;
  }

  const usersQuery = query(
    collection(db, "users"),
    where("searchTokens", "array-contains", normalized),
    limit(8),
  );
  const snapshot = await getDoc(doc(db, "users", state.currentUser.uid));
  const currentFriendIds = new Set(state.friends.keys());
  const resultsSnapshot = await getDocs(usersQuery);
  const results = resultsSnapshot.docs.map((result) => result.data());

  if (!snapshot.exists()) {
    return;
  }

  const people = results.filter((person) => person.uid !== state.currentUser.uid);

  if (!people.length) {
    selectors.searchResults.innerHTML = '<p class="form-status">No people found yet.</p>';
    return;
  }

  people.forEach((person) => {
    const alreadyFriend = currentFriendIds.has(person.uid);
    selectors.searchResults.append(
      createPersonRow(
        person,
        alreadyFriend ? "Friend" : "Add",
        () => (!alreadyFriend ? addFriend(person) : openChat(person)),
        { meta: person.email },
      ),
    );
  });
}

function subscribeToFriends(userId) {
  const unsubscribe = onSnapshot(collection(db, "users", userId, "friends"), (snapshot) => {
    state.friends.clear();
    state.unsubscribers
      .filter((entry) => entry.isFriendProfileSubscription)
      .forEach((unsubscribe) => unsubscribe());
    state.unsubscribers = state.unsubscribers.filter((entry) => !entry.isFriendProfileSubscription);

    snapshot.docs.forEach((friendDoc) => {
      const friendId = friendDoc.id;
      const friendUnsubscribe = onSnapshot(doc(db, "users", friendId), (profileDoc) => {
        if (!profileDoc.exists()) {
          return;
        }

        state.friends.set(friendId, profileDoc.data());
        renderFriends();
      });
      friendUnsubscribe.isFriendProfileSubscription = true;
      state.unsubscribers.push(friendUnsubscribe);
    });

    renderFriends();
  });

  state.unsubscribers.push(unsubscribe);
}

function subscribeToUnreadCounts(userId) {
  const conversationsQuery = query(collection(db, "conversations"), where("participants", "array-contains", userId));
  const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
    state.unreadCounts.clear();

    snapshot.docs.forEach((conversationDoc) => {
      const data = conversationDoc.data();
      const friendId = data.participants.find((participant) => participant !== userId);
      const count = data.unreadCounts?.[userId] || 0;
      state.unreadCounts.set(friendId, count);

      if (count > 0 && data.lastSenderId !== userId && friendId !== state.activeFriend?.uid) {
        const friend = state.friends.get(friendId);
        if (friend) {
          notifyForMessage(friend, data.lastMessage || "You have a new message.");
        }
      }
    });

    renderFriends();
  });

  state.unsubscribers.push(unsubscribe);
}

async function clearUnreadCount(friendId) {
  if (!state.currentUser) {
    return;
  }

  const conversationRef = doc(db, "conversations", conversationIdFor(state.currentUser.uid, friendId));
  const conversationSnapshot = await getDoc(conversationRef);

  if (!conversationSnapshot.exists()) {
    return;
  }

  await updateDoc(conversationRef, {
    [`unreadCounts.${state.currentUser.uid}`]: 0,
  });
}

function openChat(friend) {
  state.activeFriend = friend;
  selectors.emptyChat.classList.add("hidden");
  selectors.chatRoom.classList.remove("hidden");
  selectors.chatFriendAvatar.src = friend.photoURL || avatarFor(friend.displayName);
  selectors.chatFriendName.textContent = friend.displayName;
  selectors.chatFriendStatus.textContent = friend.isOnline ? "Online now" : "Offline";
  selectors.sidebar.classList.remove("open");
  selectors.messageInput.focus();
  renderFriends();
  clearUnreadCount(friend.uid);

  state.unsubscribers.filter((unsubscribe) => unsubscribe.isMessageSubscription).forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = state.unsubscribers.filter((unsubscribe) => !unsubscribe.isMessageSubscription);

  const conversationId = conversationIdFor(state.currentUser.uid, friend.uid);
  const messagesQuery = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100),
  );

  const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    selectors.messageList.innerHTML = "";

    if (snapshot.empty) {
      selectors.messageList.innerHTML = '<p class="form-status">No messages yet. Say hello!</p>';
      return;
    }

    snapshot.docs.forEach((messageDoc) => {
      const message = messageDoc.data();
      const bubble = document.createElement("article");
      bubble.className = `message ${message.senderId === state.currentUser.uid ? "mine" : ""}`.trim();
      bubble.innerHTML = `<span></span><small></small>`;
      bubble.querySelector("span").textContent = message.text;
      bubble.querySelector("small").textContent = formatTime(message.createdAt);
      selectors.messageList.append(bubble);
    });

    selectors.messageList.scrollTop = selectors.messageList.scrollHeight;
    clearUnreadCount(friend.uid);
  });
  unsubscribe.isMessageSubscription = true;
  state.unsubscribers.push(unsubscribe);
}

async function sendMessage(text) {
  if (!state.currentUser || !state.activeFriend || !text.trim()) {
    return;
  }

  const messageText = text.trim();
  const conversationId = conversationIdFor(state.currentUser.uid, state.activeFriend.uid);
  const conversationRef = doc(db, "conversations", conversationId);
  const messageRef = collection(db, "conversations", conversationId, "messages");
  const conversationSnapshot = await getDoc(conversationRef);

  if (conversationSnapshot.exists()) {
    await updateDoc(conversationRef, {
      updatedAt: serverTimestamp(),
      lastMessage: messageText,
      lastSenderId: state.currentUser.uid,
      [`unreadCounts.${state.currentUser.uid}`]: 0,
      [`unreadCounts.${state.activeFriend.uid}`]: increment(1),
    });
  } else {
    await setDoc(conversationRef, {
      participants: [state.currentUser.uid, state.activeFriend.uid],
      updatedAt: serverTimestamp(),
      lastMessage: messageText,
      lastSenderId: state.currentUser.uid,
      unreadCounts: {
        [state.currentUser.uid]: 0,
        [state.activeFriend.uid]: 1,
      },
    });
  }

  await addDoc(messageRef, {
    text: messageText,
    senderId: state.currentUser.uid,
    receiverId: state.activeFriend.uid,
    createdAt: serverTimestamp(),
    read: false,
  });
}

async function updatePresence(isOnline) {
  if (!auth.currentUser) {
    return;
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      isOnline,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function handlePhotoUpload(file) {
  if (!file || !state.currentUser) {
    return;
  }

  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
    setStatus(selectors.profileStatus, "Upload a PNG, JPEG, or WebP image.", "error");
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    setStatus(selectors.profileStatus, "Profile pictures must be under 3 MB.", "error");
    return;
  }

  setStatus(selectors.profileStatus, "Uploading profile picture...");
  const extension = file.name.split(".").pop() || "jpg";
  const photoRef = ref(storage, `profilePictures/${state.currentUser.uid}/avatar.${extension}`);
  await uploadBytes(photoRef, file, { contentType: file.type });
  const photoURL = await getDownloadURL(photoRef);

  await updateProfile(state.currentUser, { photoURL });
  await setDoc(
    doc(db, "users", state.currentUser.uid),
    {
      photoURL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  selectors.profileAvatar.src = photoURL;
  setStatus(selectors.profileStatus, "Profile picture updated.", "success");
}

selectors.loginTab.addEventListener("click", () => setAuthMode("login"));
selectors.signupTab.addEventListener("click", () => setAuthMode("signup"));
selectors.themeToggle.addEventListener("click", () => {
  const isDark = selectors.appShell.dataset.theme !== "dark";
  selectors.appShell.dataset.theme = isDark ? "dark" : "light";
  selectors.themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  selectors.themeToggle.setAttribute("aria-pressed", String(isDark));
  localStorage.setItem("knowledgePeopleTheme", isDark ? "dark" : "light");
});
selectors.mobileNavToggle.addEventListener("click", () => {
  const isOpen = selectors.sidebar.classList.toggle("open");
  selectors.mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
});
selectors.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(selectors.authStatus, "Working...");

  try {
    if (state.authMode === "signup") {
      const credential = await createUserWithEmailAndPassword(auth, selectors.email.value, selectors.password.value);
      await updateProfile(credential.user, { displayName: selectors.displayName.value.trim() });
      await createOrUpdateUserProfile(credential.user, selectors.displayName.value.trim());
      await ensureNotificationPermission();
    } else {
      await signInWithEmailAndPassword(auth, selectors.email.value, selectors.password.value);
      await ensureNotificationPermission();
    }

    selectors.authForm.reset();
    setStatus(selectors.authStatus, "");
  } catch (error) {
    setStatus(selectors.authStatus, error.message, "error");
  }
});
selectors.logoutButton.addEventListener("click", async () => {
  await updatePresence(false);
  await signOut(auth);
});
selectors.photoUpload.addEventListener("change", (event) => handlePhotoUpload(event.target.files?.[0]).catch((error) => {
  setStatus(selectors.profileStatus, error.message, "error");
}));
selectors.friendSearch.addEventListener("input", (event) => {
  window.clearTimeout(selectors.friendSearch.searchTimer);
  selectors.friendSearch.searchTimer = window.setTimeout(() => searchFriends(event.target.value).catch((error) => {
    selectors.searchResults.innerHTML = `<p class="form-status error">${error.message}</p>`;
  }), 250);
});
selectors.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = selectors.messageInput.value;
  selectors.messageInput.value = "";

  try {
    await sendMessage(message);
  } catch (error) {
    selectors.messageInput.value = message;
    alert(error.message);
  }
});
selectors.closeChatButton.addEventListener("click", () => {
  state.activeFriend = null;
  selectors.chatRoom.classList.add("hidden");
  selectors.emptyChat.classList.remove("hidden");
  renderFriends();
});
window.addEventListener("beforeunload", () => {
  updatePresence(false);
});
document.addEventListener("visibilitychange", () => {
  updatePresence(document.visibilityState === "visible");
});

const storedTheme = localStorage.getItem("knowledgePeopleTheme");
if (storedTheme === "dark") {
  selectors.appShell.dataset.theme = "dark";
  selectors.themeToggle.textContent = "Light mode";
  selectors.themeToggle.setAttribute("aria-pressed", "true");
}

onAuthStateChanged(auth, async (user) => {
  clearSubscriptions();
  state.currentUser = user;
  state.currentProfile = null;
  state.activeFriend = null;
  state.friends.clear();
  state.unreadCounts.clear();
  selectors.searchResults.innerHTML = "";
  selectors.friendSearch.value = "";
  selectors.messageList.innerHTML = "";
  selectors.chatRoom.classList.add("hidden");
  selectors.emptyChat.classList.remove("hidden");

  if (!user) {
    renderShell(false);
    return;
  }

  const profile = await createOrUpdateUserProfile(user);
  state.currentProfile = profile;
  renderProfile(profile);
  renderShell(true);
  subscribeToFriends(user.uid);
  subscribeToUnreadCounts(user.uid);
});
