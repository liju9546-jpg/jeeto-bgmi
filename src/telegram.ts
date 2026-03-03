const BOT_TOKEN = '7701092713:AAGawRL4bUcC8yN3XvcHcnzI79c-a7CDP4o';
const CHAT_ID = '-1002367434313';

const sendMessage = async (text: string) => {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });
  } catch (e) { console.log('Telegram error:', e); }
};

const sendPhoto = async (photo: File, caption: string) => {
  try {
    const fd = new FormData();
    fd.append('chat_id', CHAT_ID);
    fd.append('photo', photo);
    fd.append('caption', caption);
    fd.append('parse_mode', 'HTML');
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
  } catch (e) { console.log('Telegram error:', e); }
};

export const sendRegistrationToTelegram = async (data: {
  bgmiName: string; characterId: string; upiId: string;
  matchName: string; matchTime: string; slotNumber: number;
  paymentScreenshot: File; bgmiScreenshot: File;
}) => {
  const caption = `🚀 <b>NEW REGISTRATION!</b>\n\n👤 BGMI Name: <b>${data.bgmiName}</b>\n🎫 Slot: <b>#${data.slotNumber}</b>\n🆔 Character ID: <b>${data.characterId}</b>\n💳 UPI ID: <code>${data.upiId}</code>\n🗺️ Match: <b>${data.matchName}</b>\n⏰ Time: <b>${data.matchTime}</b>\n\n💰 Send Prize to: <code>${data.upiId}</code>\n✅ Verify in Admin Panel!`;
  await sendPhoto(data.paymentScreenshot, caption);
  if (data.bgmiScreenshot) {
    await sendPhoto(data.bgmiScreenshot, `📸 BGMI Profile Screenshot\n👤 ${data.bgmiName} | 🆔 ${data.characterId}`);
  }
};

export const sendResultToTelegram = async (data: {
  bgmiName: string; matchName: string; screenshot: File;
}) => {
  await sendPhoto(data.screenshot, `🏆 <b>RESULT SUBMISSION!</b>\n\n👤 Player: <b>${data.bgmiName}</b>\n🗺️ Match: <b>${data.matchName}</b>\n\n📸 Winner Screenshot attached!`);
};

export const sendAddCashToTelegram = async (data: {
  userName: string; email: string; bgmiName: string;
  amount: number; screenshot: File;
}) => {
  await sendPhoto(data.screenshot, `💰 <b>ADD CASH REQUEST!</b>\n\n👤 Name: <b>${data.userName}</b>\n📧 Email: <b>${data.email}</b>\n🎮 BGMI: <b>${data.bgmiName}</b>\n💵 Amount: <b>₹${data.amount}</b>\n\n✅ Approve in Admin Panel → Add Cash Tab`);
};

export const sendSupportToTelegram = async (data: {
  userName: string; bgmiName: string; email: string;
  category: string; message: string;
}) => {
  await sendMessage(`🆘 <b>SUPPORT REQUEST!</b>\n\n👤 Player: <b>${data.userName}</b>\n🎮 BGMI: <b>${data.bgmiName}</b>\n📧 Reply to: <code>${data.email}</code>\n📋 Category: <b>${data.category}</b>\n\n💬 Message:\n"${data.message}"\n\n📩 REPLY TO: <code>${data.email}</code>`);
};

export const sendWinnerAnnouncementToTelegram = async (data: {
  matchName: string; first: string; second: string; third: string;
  prize1: number; prize2: number; prize3: number; totalPrize: number;
}) => {
  await sendMessage(`🏆 <b>MATCH RESULTS!</b>\n\n🗺️ ${data.matchName}\n\n🥇 1st: <b>${data.first}</b> — ₹${data.prize1}\n🥈 2nd: <b>${data.second}</b> — ₹${data.prize2}\n🥉 3rd: <b>${data.third}</b> — ₹${data.prize3}\n\n💰 Total Prize: ₹${data.totalPrize}\n🎮 Powered by JEETO Platform`);
};

export const sendBroadcastToTelegram = async (message: string, duration: string) => {
  await sendMessage(`📢 <b>BROADCAST!</b>\n\n${message}\n\n⏱️ Duration: ${duration}`);
};

export const sendFraudAlertToTelegram = async (data: {
  bgmiName: string; characterId: string; matchName: string;
}) => {
  await sendMessage(`⚠️ <b>FRAUD ATTEMPT!</b>\n\n👤 Name: ${data.bgmiName}\n🆔 ID: ${data.characterId} (already registered!)\n🗺️ Match: ${data.matchName}\n🚨 BLOCKED automatically!`);
};
