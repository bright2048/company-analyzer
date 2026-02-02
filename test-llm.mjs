async function testLLM() {
  try {
    const response = await fetch(process.env.LLM_API_URL + "/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "qwen-plus",
        messages: [{ role: "user", content: "请回复：LLM连接测试成功" }],
        max_tokens: 50,
      }),
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      console.log("✅ 通义千问测试成功");
      console.log("   回复:", data.choices[0].message.content);
    } else {
      console.error("❌ 通义千问测试失败:", data);
    }
  } catch (error) {
    console.error("❌ 通义千问测试失败:", error.message);
  }
}

testLLM();
