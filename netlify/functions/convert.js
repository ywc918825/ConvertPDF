const axios = require('axios');

const MINERU_TOKEN = 'eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiI1MDcwMDU4NiIsInJvbCI6IlJPTEVfUkVHSVNURVIiLCJpc3MiOiJPcGVuWExhYiIsImlhdCI6MTc3ODU2NjA3MiwiY2xpZW50SWQiOiJsa3pkeDU3bnZ5MjJqa3BxOXgydyIsInBob25lIjoiIiwib3BlbklkIjpudWxsLCJ1dWlkIjoiMjUzYWUxYWEtYzkzMi00ZmFhLWJlZGUtOTQ0MGEzYmE4N2RmIiwiZW1haWwiOiIiLCJleHAiOjE3ODYzNDIwNzJ9.61mmGOZuBleHoGkSXyOK1p20GT9dLlwe7h9khlZ-PcCFdIBk9n8TZgeh6mFEIq6cmgJAgnQOv8g-ii_DRCHdOw';
const BASE_API_URL = 'https://mineru.net/api/v4';

exports.handler = async (event) => {
  // 处理 CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '仅支持 POST' })
    };
  }

  try {
    const { fileUrl, fileName, targetFormat } = JSON.parse(event.body);
    if (!fileUrl) throw new Error('缺少文件地址');

    const format = targetFormat || 'docx';

    // 1. 提交 MinerU 解析任务
    const taskRes = await axios.post(`${BASE_API_URL}/extract/task`, {
      url: fileUrl,
      checksum: '',
      content: JSON.stringify({ file_name: fileName || 'document.pdf' })
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(MINERU_TOKEN !== 'agent' && { Authorization: `Bearer ${MINERU_TOKEN}` })
      }
    });

    if (taskRes.data.status !== 'success') {
      throw new Error(taskRes.data.message || '任务提交失败');
    }
    const taskId = taskRes.data.data.task_id;

    // 2. 轮询任务结果（最多等待 60 秒）
    let downloadUrl = null;
    for (let i = 0; i < 30; i++) {
      const statusRes = await axios.get(`${BASE_API_URL}/extract/task/${taskId}`, {
        headers: {
          ...(MINERU_TOKEN !== 'agent' && { Authorization: `Bearer ${MINERU_TOKEN}` })
        }
      });
      if (statusRes.data.data.task_status === 'done') {
        downloadUrl = statusRes.data.data.download_url;
        break;
      }
      if (statusRes.data.data.task_status === 'failed') {
        throw new Error('转换任务失败');
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!downloadUrl) throw new Error('转换超时，请重试');

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, downloadUrl })
    };
  } catch (err) {
    console.error('转换失败:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
