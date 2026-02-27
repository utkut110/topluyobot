module.exports = {
    name: "ping",
    description: "Botun gecikme süresini gösterir",
    usage: "!ping",
    async execute({ event, post, send }) {
        const start = Date.now();
        await post("/test/time", {});
        const ms = Date.now() - start;
        return send(event.channel_id, `\`\`\`\n🏓 Gecikme: ${ms}ms\n\`\`\``);
    }
};
