'use strict';

const util = require('util');
const request = require('request');
const config = require('../config/config');
// const transcript = require('../chats/transcript.json');



function getNextPingURL(linkArr) {
    for (let i = 0; i < linkArr.length; i++) {
        const link = linkArr[i];
        if (link['@rel'] === 'next') {
            return link['@href'].replace('/events', '/events.json');
        }
    }
}

class AgentChat {
    constructor(session, chatURL) {
        this.session = session;
        this.chatURL = chatURL;
        this.lineIndex = 0;
        this.chatPingInterval = 2000;
    }

    start(callback) {
        this.startChatSession((err, data) => {
            if (err) {
                callback(err);
            }
            else {
                callback(null);
                this.chatLink = data.chatLink;
                this.chatPolling();
            }
        });
    }

    startChatSession(callback) {
        console.log(`(startChatSession) In linkForNextChat: ${this.chatURL}`);

        const options = {
            method: 'POST',
            url: `${this.chatURL}.json?v=1&NC=true`,
            headers: {
                'Authorization': `Bearer ${this.session.getBearer()}`,
                'content-type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            json: true,
            body: {'chat': 'start'}
        };

        request(options, (error, response, body) => {
            if (error) {
                callback(`Failed to start chat session with error: ${JSON.stringify(error)}`);
            }
            else if(response.statusCode < 200 || response.statusCode > 299){
                callback(`Failed o start chat session with error: ${JSON.stringify(body)}`);
            }
            console.log(`Start chat session - body: ${body.chatLocation.link['@href']}`);
            callback(null, {
                chatLink: body.chatLocation.link['@href']
            });
        });
    }

    chatPolling(url) {
        if (!url) {
            url = this.chatLink + '.json?v=1&NC=true'
        }

        const options = {
            method: 'GET',
            url: url,
            headers: {
                'Authorization': `Bearer ${this.session.getBearer()}`,
                'content-type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            json:true
        };

        request(options, (error, response, body)=> {
            if (error) {
                console.error(`Agent polling failed. Error: ${JSON.stringify(error)}`);
                return;
            }
            else if(response.statusCode < 200 || response.statusCode > 299){
                console.error(`Agent polling failed. body: ${JSON.stringify(body)}`);
                return;
            }
            let events;
            let nextURL;

            if (body.chat && body.chat.error) {
                console.log(`Chat error: ${JSON.stringify(body.chat.error)}`);
                return;
            }

            if (body.chat && body.chat.events) {
                nextURL = `${getNextPingURL(body.chat.events.link)}&v=1&NC=true`;
                events = body.chat['events']['event'];
            }
            else {
                try {
                    nextURL = `${getNextPingURL(body.events.link)}&v=1&NC=true`;
                }
                catch (e) {
                    console.log(`Error getting the next URL link: ${e.message}, body=${JSON.stringify(body)}`);
                    return;
                }
                events = body['events']['event'];
            }

            if (events) {
                
                if (!Array.isArray(events)) { // The API send an object and not an array if there is 1 event only
                    events = [events];
                }
                // console.log(events);
                var escalationIndicator =0;
                var targeteve;
                for (let i = 0; i < events.length ; i++) {
                    const ev = events[i];

                    console.log(ev)
                    if ((ev['@type'] === 'state') && (ev.state === 'ended')) {
                        return;
                    }

                    if(ev.hasOwnProperty("systemMessageId") && (ev.systemMessageId==15)){
                        console.log("System generated Events",ev.text);
                        console.log("TEXT TO PROCESS WILL BE DETERMINED");
                        console.log("TEXT TO PROCESS",events[i-1].text);
                        targeteve=events[i-1];
                        escalationIndicator=1;
                    }   
                }
                if(escalationIndicator==1){
                    this.processor(targeteve);
                }
                else if (escalationIndicator==0){
                    for (let i = 0; i < events.length ; i++) {
                        const ev = events[i];
    
                        console.log(ev)
                        if ((ev['@type'] === 'state') && (ev.state === 'ended')) {
                            return;
                        }
                        else if(ev.hasOwnProperty("source") && ev.source=='visitor' && (!ev.hasOwnProperty("lineStatus"))){
                            console.log("TEXT TO PROCESS",ev.text);
                            targeteve=events[i];
                            // this.processor(ev);
                            // break;
                        }
                    }
                    this.processor(targeteve);
                }
            }
            this.chatTimer = setTimeout(() => {
                this.chatPolling(nextURL);
            }, this.chatPingInterval);
        });
    }


    processor(ev){
        if(ev!=null){
        console.error("CAPTURED EVENT",ev);
        if ((ev['@type'] === 'line') && (ev['source'] === 'visitor')) {
                console.log(`(chatPolling) - line form visitor:${ev.text}`);
                console.log("GOT IT CAUGHT THE INCOMMING TEXT",ev.text);
                var ob =this;
                ob.aiengine(ev.text,function(data){
                    if(data.result.action ==="input.unknown"||data.result.action=== "EscalationQuery"){
                        ob.availability((reqdata)=>{
                            var data = JSON.parse(reqdata);
                            console.log("PRINTING AVAILABLITY STATUS",data.transfer.skill.onlineAgents,data.transfer.skill.name);
                            ob.transfer(data.transfer.skill.id,(status)=>{
                                console.log("TRANSFER STATUS :",JSON.stringify(status.statusCode));
                                return;
                            });
                        });

                        
                        }else{
                            if(data.result.fulfillment.speech===""){
                                ob.sendLine(data.result.fulfillment.messages[0].payload,"rich");
                            }else{
                                console.log(data.result.fulfillment.speech);
                                ob.sendLine(data.result.fulfillment.speech,"text");
                            }
                    }
                });
            }
        }
    }




    availability(callback){
        console.log("CHECKING AVAILABLITY");
        const options = {
            method: 'GET',
            url: `${this.chatLink}/transfer?v=1&NC=true`,
            headers: {
                'Authorization': `Bearer ${this.session.getBearer()}`,
                'content-type': 'application/json',
                'Accept': 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) throw new Error(error);
            callback(body)
            // console.log("PRINTING AVAILABILITY",JSON.stringify(body));
          });
        // console.log(options);
    }

    transfer(skillid,callback){
        console.log("SKILL:",skillid);
        const options = {
            method: 'POST',
            url: `${this.chatLink}/transfer?v=1&NC=true`,
            headers: {
                'Authorization': `Bearer ${this.session.getBearer()}`,
                'content-type': 'application/json',
                'Accept': 'application/json'
            },
            json: true,
            body: {
                "transfer":{
                    "skill":{
                        "id":skillid
                    }
                }
            }
        };

        request(options, function (error, response, body) {
            if (error) throw new Error(error);
            callback(response)
            // console.log("PRINTING AVAILABILITY",JSON.stringify(body));
          });
        

    }
    
    aiengine(usersays,callback){
        var options = { 
            method: 'POST',
            url: 'https://api.dialogflow.com/v1/query',
            qs: { v: '20150910' },
            headers: { 
                'cache-control': 'no-cache',
                authorization: 'Bearer ecc7cc7fb2794fd9a0eb2328f4ebec5b',
                'content-type': 'application/json'
            },

            body: { 
                lang: 'en',
                query: usersays,
                sessionId: '12543534345'
            },
            json: true 
        };
        
            request(options, function (error, response, body) {
            if (error) throw new Error(error);
            callback(body)
            //   console.log(body);
            });
        
    }

    sendLine(botsays,type) {

        var payload
        
        if(type==="rich"){
            payload={
                '@type':'line',
                'textType':'rich-content',
                'json':botsays
            }
        }else{
            payload={
                '@type': 'line',
                'text': `<p dir='ltr' style='direction: ltr; text-align: left;'>${botsays}</p>`,
                'textType': 'html',
            }
        }
            const options = {
            method: 'POST',
            // url: `${this.chatLink}/events.json?v=1&NC=true`,
            url: `${this.chatLink}/events?v=1&NC=true`,
            headers: {
                'Authorization': `Bearer ${this.session.getBearer()}`,
                'content-type': 'application/json',
                'Accept':'application/json'
            },
            json: true,
            body: {
                event: payload
                } 
        };

        setTimeout(() => {
            request(options, (error, response, body) => {
                this.lineIndex++;
                if (error) {
                    console.log(`Error sending line. Error: ${JSON.stringify(error)}`);
                }
                else if(response.statusCode < 200 || response.statusCode > 299){
                    console.log(`Error sending line. Body: ${JSON.stringify(body)}`);

                }
                console.log(`Send line: ${JSON.stringify(body)}`);
            });
        }, config.chat.minLineWaitTime);
    }

    stop(callback) {
        clearTimeout(this.chatTimer);
        clearTimeout(this.incomingTimer);

        if (this.chatLink) {
            const options = {
                method: 'POST',
                url: `${this.chatLink}/events.json?v=1&NC=true`,
                headers: {
                    'Authorization': `Bearer ${this.session.getBearer()}`,
                    'content-type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                json: true,
                body: {
                    event: {
                        '@type': 'state',
                        'state': 'ended'
                    }
                }
            };
            request(options, (error, response, body) => {
                if (error) {
                    callback(`Error trying to end chat: ${JSON.stringify(error)}`);
                }
                else if(response.statusCode < 200 || response.statusCode > 299){
                    callback(`Error trying to end chat: ${JSON.stringify(body)}`);
                }
                this.session.stop(err => {
                    if (err) {
                        console.log(`Error stopping session: ${err.message}`);
                        callback(err);
                    }
                    else {
                       callback();
                    }
                });
            });
        }else{
            callback(`Chat link is unavailable chatLink: ${this.chatLink}`);
        }
    }

}

module.exports = AgentChat;
