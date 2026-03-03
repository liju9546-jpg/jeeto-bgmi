const BOT_TOKEN = '7701092713:AAF261wNa1qcUyOcOE7qygvgbpI4P-0YfnM;
const CHAT_ID = '-1003739888243';

const sendMessage = async (text: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram sendMessage failed:', result);
      return false;
    }
    console.log('Telegram message sent successfully!');
    return true;
  } catch (e) {
    console.error('Telegram sendMessage error:', e);
    return false;
  }
};

const sendPhoto = async (photo: File, caption: string): Promise<boolean> => {
  try {
    const fd = new FormData();
    fd.append('chat_id', CHAT_ID);
    fd.append('photo', photo, photo.name);
    fd.append('caption', caption);
    fd.append('parse_mode', 'HTML');

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: fd
    });
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram sendPhoto failed:', result);
      // Fallback: send as text message
      await sendMessage(caption + '\n\n📸 [Screenshot uploaded by user]');
      return false;
    }
    console.log('Telegram photo sent successfully!');
    return true;
  } catch (e) {
    console.error('Telegram sendPhoto error:', e);
    // Fallback: send text message
    await sendMessage(caption + '\n\n📸 [Screenshot uploaded by user]');
    return false;
  }
};

export const sendRegistrationToTelegram = async (data: {
  bgmiName: string;
  characterId: string;
  upiId: string;
  matchName: string;
  matchTime: string;
  slotNumber: number;
  paymentScreenshot?: File;
  bgmiScreenshot?: File;
}): Promise<void> => {
  const text = `🚀 <b>NEW REGISTRATION!</b>

👤 BGMI Name: <b>${data.bgmiName}</b>
🎫 Slot Number: <b>#${data.slotNumber}</b>
🆔 Character ID: <b>${data.characterId}</b>
💳 UPI ID: <code>${data.upiId}</code>
🗺️ Match: <b>${data.matchName}</b>
⏰ Time: <b>${data.matchTime}</b>

💰 Send Prize to: <code>${data.upiId}</code>
✅ Verify in Admin Panel!`;

  // Always send text message first (guaranteed delivery)
  await sendMessage(text);

  // Then try to send screenshots
  if (data.paymentScreenshot) {
    await sendPhoto(
      data.paymentScreenshot,
      `💳 Payment Screenshot\n👤 ${data.bgmiName} | Slot #${data.slotNumber}\n🗺️ ${data.matchName}`
    );
  }

  if (data.bgmiScreenshot) {
    await sendPhoto(
      data.bgmiScreenshot,
      `📸 BGMI Profile Screenshot\n👤 ${data.bgmiName} | 🆔 ${data.characterId}`
    );
  }
};

export const sendPaymentToTelegram = async (data: {
  bgmiName: string;
  slotNumber: number;
  matchName: string;
  upiId: string;
  screenshot?: File;
}): Promise<void> => {
  const text = `💳 <b>PAYMENT SUBMITTED!</b>

👤 Player: <b>${data.bgmiName}</b>
🎫 Slot: <b>#${data.slotNumber}</b>
🗺️ Match: <b>${data.matchName}</b>
💳 UPI: <code>${data.upiId}</code>

✅ Check Admin Panel → Payments Tab
Approve or Reject the payment!`;

  await sendMessage(text);

  if (data.screenshot) {
    await sendPhoto(
      data.screenshot,
      `💳 Payment Screenshot\n👤 ${data.bgmiName} | Slot #${data.slotNumber}`
    );
  }
};

export const sendResultToTelegram = async (data: {
  bgmiName: string;
  matchName: string;
  screenshot: File;
}): Promise<void> => {
  const text = `🏆 <b>RESULT SUBMISSION!</b>

👤 Player: <b>${data.bgmiName}</b>
🗺️ Match: <b>${data.matchName}</b>

📸 Winner screenshot attached below!`;

  await sendMessage(text);
  await sendPhoto(data.screenshot, `🏆 Winner Screenshot - ${data.bgmiName}`);
};

export const sendAddCashToTelegram = async (data: {
  userName: string;
  email: string;
  bgmiName: string;
  amount: number;
  screenshot?: File;
}): Promise<void> => {
  const text = `💰 <b>ADD CASH REQUEST!</b>

👤 Name: <b>${data.userName}</b>
📧 Email: <b>${data.email}</b>
🎮 BGMI: <b>${data.bgmiName}</b>
💵 Amount: <b>₹${data.amount}</b>

✅ Approve in Admin Panel → Add Cash Tab`;

  await sendMessage(text);

  if (data.screenshot) {
    await sendPhoto(
      data.screenshot,
      `💰 Add Cash Payment Screenshot\n👤 ${data.userName} | ₹${data.amount}`
    );
  }
};

export const sendSupportToTelegram = async (data: {
  userName: string;
  bgmiName: string;
  email: string;
  category: string;
  message: string;
}): Promise<void> => {
  await sendMessage(`🆘 <b>SUPPORT REQUEST!</b>

👤 Player: <b>${data.userName}</b>
🎮 BGMI Name: <b>${data.bgmiName}</b>
📧 Reply To: <code>${data.email}</code>
📋 Category: <b>${data.category}</b>

💬 Message:
"${data.message}"

📩 REPLY TO EMAIL: <code>${data.email}</code>
⚡ Reply ASAP!`);
};

export const sendWinnerAnnouncementToTelegram = async (data: {
  matchName: string;
  first: string;
  second: string;
  third: string;
  prize1: number;
  prize2: number;
  prize3: number;
  totalPrize: number;
}): Promise<void> => {
  await sendMessage(`🏆 <b>MATCH RESULTS ANNOUNCED!</b>

🗺️ <b>${data.matchName}</b>

🥇 1st Place: <b>${data.first}</b> — ₹${data.prize1}
🥈 2nd Place: <b>${data.second}</b> — ₹${data.prize2}
🥉 3rd Place: <b>${data.third}</b> — ₹${data.prize3}

💰 Total Prize: <b>₹${data.totalPrize}</b>
🎮 Powered by JEETO Tournament Platform`);
};

export const sendBroadcastToTelegram = async (
  message: string,
  duration: string
): Promise<void> => {
  await sendMessage(`📢 <b>BROADCAST MESSAGE!</b>

${message}

⏱️ Duration: ${duration}
🌐 Visible on website now!`);
};

export const sendFraudAlertToTelegram = async (data: {
  bgmiName: string;
  characterId: string;
  matchName: string;
}): Promise<void> => {
  await sendMessage(`⚠️ <b>FRAUD ATTEMPT DETECTED!</b>

👤 Name: <b>${data.bgmiName}</b>
🆔 Character ID: <b>${data.characterId}</b> (already registered!)
🗺️ Match: <b>${data.matchName}</b>

🚨 Registration BLOCKED automatically!
🔍 Check Admin Panel for details.`);
};

export const sendWithdrawalToTelegram = async (data: {
  userName: string;
  email: string;
  bgmiName: string;
  upiId: string;
  amount: number;
}): Promise<void> => {
  await sendMessage(`💸 <b>WITHDRAWAL REQUEST!</b>

👤 Name: <b>${data.userName}</b>
📧 Email: <b>${data.email}</b>
🎮 BGMI: <b>${data.bgmiName}</b>
💳 UPI ID: <code>${data.upiId}</code>
💵 Amount: <b>₹${data.amount}</b>

✅ Approve in Admin Panel → Withdrawals Tab
Send money to UPI: <code>${data.upiId}</code>`);
};
