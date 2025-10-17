export default async function handler(req, res){
  try{
    const key = process.env.OPENAI_API_KEY;
    if(!key){ return res.status(500).json({error:"Missing OPENAI_API_KEY"}); }

    const payload = req.body || {};
    const system = { role:"system", content:"You are a certified fitness & nutrition coach. Be concise, positive, practical. Avoid medical claims." };
    const user = { role:"user", content: JSON.stringify(payload) + "\n\nReturn STRICT JSON with keys: workout, nutrition, hydration_sleep, motivation. No extra text." };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{ "Authorization":"Bearer "+key, "Content-Type":"application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [system, user],
        max_tokens: 600
      })
    });
    if(!r.ok){ const t = await r.text(); return res.status(500).json({error:"OpenAI error", detail:t}); }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(content);
    return res.status(200).json(json);
  }catch(e){
    return res.status(500).json({error:String(e)});
  }
}
