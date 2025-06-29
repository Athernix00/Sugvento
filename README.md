# 💡 Sugvento - Discord Suggestions Bot

![Sugvento Banner](https://capsule-render.vercel.app/api?type=waving&color=00BFFF&height=200&section=header&text=Sugvento&fontSize=75&fontAlignY=40&animation=fadeIn&fontColor=ffffff)

> A powerful and interactive suggestion system for Discord servers. Let your community share their voice — and vote on it too.

---

### 👤 Owner  
**Developed by [Athernix00](https://github.com/Athernix00)**

---

## ✨ Features

- 📬 Submit suggestions via `/suggest`  
- 🗳️ Interactive voting with 👍 and 👎 buttons  
- 📥 Custom suggestion and log channels  
- 🛡️ Admin approval & denial commands  
- 🧠 Auto-thread creation for community discussion  
- 📝 Clean embed design with status updates  
- 🆔 Suggestion IDs for management  
- 🔒 Permission-based command control  
- ⚡ Fast, optimized performance with discord.js  

---

## 💻 Slash Commands

| Command         | Description                             |  
|-----------------|-----------------------------------------|  
| `/suggest`      | Submit a new suggestion                 |  
| `/set-channel`  | Set the main suggestion channel         |  
| `/set-log`      | Set the log channel for staff actions   |  
| `/approve`      | Approve a suggestion by ID              |  
| `/deny`         | Deny a suggestion by ID                 |  
| `/config`       | View current bot configuration          |  
| `/help`         | Show the help panel                     |  
| `/ping`         | Check bot latency                       |  

---

## 🧠 How It Works

1. When someone posts in the **suggestion channel**, their message is deleted.  
2. The bot reposts the suggestion as a **rich embed**:  
   - Title: `A New Suggestion [Pending]`  
   - Fields:  
     - 👍 Upvotes: `0` (inline)  
     - 👎 Downvotes: `0` (inline)  
   - Buttons: `👍 Upvote` and `👎 Downvote`  
   - Each suggestion gets a **unique ID**.  
3. The bot automatically creates a **thread** under the suggestion and pings the suggester:  
   - Example: `Discuss here @username`  
4. Admins can use:  
   - `/approve <id>` → Title changes to `[Approved]`  
   - `/deny <id>` → Title changes to `[Denied]`  
5. All actions can be logged in the set log channel.  

---

## 📷 Preview

![Preview](https://i.imgur.com/1L9ZQOj.png) <!-- Replace this with your own embed preview -->

---

## 🛠️ Installation

1. **Clone the repository**  
   ```  
   git clone https://github.com/Athernix00/sugvento.git  
   cd sugvento  
   ```

2. **Install dependencies**

   ```
   npm install  
   ```

3. **Configure environment**

   * rename `.env.example` to `.env`

   * Fill in:
     * `DISCORD_TOKEN=your_token`


4. **Run the bot**

   ```
   node sugvento.js  
   ```

---

## 🧩 Requirements

* `Manage Messages`
* `Create Public Threads`
* `Embed Links`
* `Use Application Commands`
* `Read Message History`

---

## 📊 Future Plans

* Suggestion dashboard (web-based)
* Analytics (using QuickChart)
* Slash-command cooldown system
* Language/localization support

---

## ⚖️ License

Licensed under the **MIT License** © [Athernix00](https://github.com/Athernix00)

---

> 💬 *"Sugvento gives your community a voice — one suggestion at a time."*
