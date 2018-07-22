/*
 Startup : Loads environment variables and puts the bot online
 */
const agentBot =require('./lib/agentBot');
const aiEngine =require('./lib/aiEngine'); 

const accId = process.env.accid
const botName = process.env.botname
const pass = process.env.pass
const token =process.env.token

if(accId == null || botName == null || pass == null || token == null){
    console.log("Opps credentials missing !!",accId,botName,pass,token);
}else{
    console.log("LETS PUT THIS BOT ONLINE");
    const agent = new agentBot(accId,botName,pass);
    agent.start();
}


