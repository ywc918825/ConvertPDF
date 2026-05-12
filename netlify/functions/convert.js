const axios = require('axios');
const CONVERT_API_BASE = 'https://v2.convertapi.com';
const CONVERT_API_TOKEN = process.env.CONVERT_API_TOKEN || 'eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiI1MDcwMDU4NiIsInJvbCI6IlJPTEVfUkVHSVNURVIiLCJpc3MiOiJPcGVuWExhYiIsImlhdCI6MTc3ODU2NjA3MiwiY2xpZW50SWQiOiJsa3pkeDU3bnZ5MjJqa3BxOXgydyIsInBob25lIjoiIiwib3BlbklkIjpudWxsLCJ1dWlkIjoiMjUzYWUxYWEtYzkzMi00ZmFhLWJlZGUtOTQ0MGEzYmE4N2RmIiwiZW1haWwiOiIiLCJleHAiOjE3ODYzNDIwNzJ9.61mmGOZuBleHoGkSXyOK1p20GT9dLlwe7h9khlZ-PcCFdIBk9n8TZgeh6mFEIq6cmgJAgnQOv8g-ii_DRCHdOw'; // 建议使用环境变量

exports.handler = async (event) => {
  // 关键！处理预检请求
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
    // 解析前端传来的 base64 文件内容和参数
    const { fileBase64, fileName, targetFormat } = JSON.parse(event.body);
    
    // 将 base64 转为 Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    // 1. 上传文件到 ConvertAPI
    const uploadRes = await axios.post(
      `${CONVERT_API_BASE}/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${CONVERT_API_TOKEN}`
        }
      }
    );

    if (uploadRes.data.Error) {
      throw new Error(uploadRes.data.Error);
    }
    const fileId = uploadRes.data.FileId;
    const fileExt = uploadRes.data.FileExt;

    // 2. 调用转换接口
    const convertUrl = `${CONVERT_API_BASE}/convert/${fileExt}/to/${targetFormat}`;
    const convertBody = {
      Parameters: [
        { Name: 'FileId', Value: fileId },
        { Name: 'StoreFile', Value: true }
      ]
    };

    const convertRes = await axios.post(convertUrl, convertBody, {
      headers: {
        'Authorization': `Bearer ${CONVERT_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (convertRes.data.Error) throw new Error(convertRes.data.Error);
    if (!convertRes.data.Files || convertRes.data.Files.length === 0) {
      throw new Error('转换失败：服务器未返回文件');
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        downloadUrl: convertRes.data.Files[0].Url
      })
    };
  } catch (err) {
    console.error('函数错误:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};