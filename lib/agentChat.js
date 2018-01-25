

/* -------------------------------------------------------------------
Copyright (c) 2017-2018 Hexaware Technologies
This file is part of the Innovation LAB - Ricoh AI chatbot.
------------------------------------------------------------------- */

/*
 
 */
'use strict';

const util = require('util');
const request = require('request');
const config = require('../config/config');
const aiEngine = require('./aiEngine');



function getNextPingURL(linkArr) {
    for (let i = 0; i < linkArr.length; i++) {
        const link = linkArr[i];
        if (link['@rel'] === 'next') {
            return link['@href'].replace('/events', '/events.json');
        }
    }
}

class AgentChat extends aiEngine{
    constructor(session, chatURL) {
        super(process.env.token);   
        this.session = session;
        this.chatURL = chatURL;
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
        console.log(`(startChatSession) In linkForNextChat: \\n ${this.chatURL}`);

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
            // console.log(`Start chat session - body: ${body.chatLocation.link['@href']}`);
            console.log(`chat session - Started`);
            callback(null, {
                chatLink: body.chatLocation.link['@href']
            });
        });
    }
//==========================================MODIFIED BY HEXAWARE======================================================//
    /*this method is modified by hexaware to integrate with an AI Engine */
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
                /**this loop checks if it is a transfered list of events */
                var targetIndex=0; 

                for (let i = 0; i < events.length; i++){
                    if(events[i].hasOwnProperty("systemMessageId") && (events[i].systemMessageId==15)){
                        targetIndex=i;
                    }
                }
                
                /**this loop selects events to be processed */
                for (let i = targetIndex; i < events.length; i++) {
                    const ev = events[i];

                    if ((ev['@type'] === 'state') && (ev.state === 'ended')) {
                        return;
                    }
                    else if ((ev['@type'] === 'line') && (ev['source'] === 'visitor')) {
                        console.log(`(chatPolling) - line form visitor:${ev.text}`);
                        
                        /*sends the target event to process*/
                        this.textProcessor(ev);
                        
                    }
                }

            }
            this.chatTimer = setTimeout(() => {
                this.chatPolling(nextURL);
            }, this.chatPingInterval);
        });
    }
//==========================================DEFINED BY HEXAWARE======================================================//
//checks if escalation is required or can be handled by bot

    textProcessor(ev){

        this.interactionHandler(ev,(escalationIndicator,data,err)=>{
            if(err){
                console.error("ERROR IN interactionHandler",err);
            }else{
                console.log("escalationIndicator :",escalationIndicator);
                if(escalationIndicator){
                    this.skillAvailability((skills,err)=>{
                        if(err!=null){
                            console.error("ERROR IN CHECKING SKILL AVAILABILITY")
                        }else{
                            console.log("avialable skills",skills)

                            if(typeof skills[0] != 'undefined'){
  
                                for(let i=0;i<skills.length;i++){
                                    
                                    if(skills[i].name==="Live-agent"){
                                        console.log("SKILL",skills[i].id,skills[i].name)
                                        this.transfer(skills[i].id,(status,err)=>{
                                            if(err!=null){
                                                console.log("ERROR in escalation",err);
                                                this.sendLine("I am facing some issues connecting to my boss please come back after a while.","text");
                                            }else{
                                                console.log("TRANSFER STATUS :",JSON.stringify(status.statusCode));
                                            }
                                        })
                                        break;
                                    }else{
                                        this.sendLine("There are no live agents available at this time.Please <a href='http://ec2-34-235-155-124.compute-1.amazonaws.com:3000/offline'>click Here</a> to leave a message","text");
                                    }
                            
                                }
                            }else{
                                this.sendLine("There are no live agents available at this time.Please <a href='http://ec2-34-235-155-124.compute-1.amazonaws.com:3000/offline'>click Here</a> to leave a message","text");
                            }
                        }
                    })
                }else{

                    console.log("INTENT NAME",data.result.metadata.intentName)
                    if(data.result.fulfillment.speech!=null && data.result.fulfillment.messages.length>1){
                        
                        this.sendLine(data.result.fulfillment.speech,"text");
                        
                        var t = this;
                        setTimeout(function(){
                            t.sendLine(data.result.fulfillment.messages[1].payload,"rich");
                            console.log("inside timeout");
                        }, 1000);
                        // setTimeout(this.sendLine, 100, data.result.fulfillment.messages[1].payload,"rich");
                        // this.sendLine(data.result.fulfillment.messages[1].payload,"rich");

                    }else if(data.result.fulfillment.speech===""){

                        this.sendLine(data.result.fulfillment.messages[0].payload,"rich");

                    }else{
                        
                        this.sendLine(data.result.fulfillment.speech,"text");
                    }    
                    
                }
            }
        }); 
    }
//==========================================MODIFIED BY HEXAWARE======================================================//
    /*this method is modified by hexaware to serve both plain text and rich content as bot response */
    
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

                if (error) {
                    console.log(`Error sending line. Error: ${JSON.stringify(error)}`);
                }
                else if(response.statusCode < 200 || response.statusCode > 299){
                    console.log(`Error sending line. Body: ${JSON.stringify(body)}`);

                }
                // console.log(`Send line: ${JSON.stringify(body)}`);
                console.log("MSG SENT")
            });
        }, config.chat.minLineWaitTime);
    }

/*Check for avaliable skill groups and returns list of available skills*/
    skillAvailability(callback){
        var skills=[];
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
            if (error!=null){
                // console.error("ERROR IN CHECKING SKILL AVAILABLITY");
                callback(null,error);
            }else{
                
                let data=JSON.parse(body);
                if(Array.isArray(data.transfer.skill)){
                    skills=data.transfer.skill;
                }else{
                    skills.push(data.transfer.skill)
                }
                
                callback(skills,null);
            } 
            
          });
    }

    transfer(skillid,callback){
        console.log("SKILLID",skillid);
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
            if(error!=null){
                callback(null,error)
            }else{
                callback(response,null)
            }
          });
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
