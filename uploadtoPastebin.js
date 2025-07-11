const axios = require('axios');
require('dotenv').config();

async function uploadToPastebin(title, content) {
  try {
    const response = await axios.post('https://pastebin.com/api/api_post.php', null, {
      params: {
        api_dev_key: process.env.PASTEBIN_API_KEY,
        api_option: 'paste',
        api_paste_code: title,
        api_paste_name: title,
        api_paste_expire_date: 'N',
        api_paste_format: 'html',
        api_paste_private: 1,
        api_paste_code: title,
        api_paste_data: content
      }
    });
    return response.data;
  } catch (err) {
    console.error('Pastebin error:', err.response?.data || err.message);
    return 'Pastebin upload failed';
  }
}

module.exports = uploadToPastebin;