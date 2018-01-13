/* -------------------------------------------------------------------
Copyright (c) 2017-2018 Hexaware Technologies
This file is part of the Innovation LAB - Ricoh AI chatbot.
------------------------------------------------------------------- */

/*
 Class which has all Ai components of the bot
 */
var request = require('request');

class aiEngine{
    
    constructor(aiClientToken){
        console.log("Got the client token",aiClientToken);
        console.log("Pluging in AI Engine");
        this.aiClientToken=aiClientToken
        this.escalationIndicator=false;
    }
    
    connector(usersays,callback){
        var options = { 
            method: 'POST',
            url: 'https://api.dialogflow.com/v1/query',
            qs: { v: '20150910' },
            headers: { 
                'cache-control': 'no-cache',
                authorization: 'Bearer '+this.aiClientToken,
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
                if (error){
                    callback(null,error)
                }else{
                    callback(body,null);
                }
            
            });
    }


    interactionHandler(incommingEvent,callback){
        console.log("decides whether to escalate or process it");
        this.connector(incommingEvent.text,(body,err)=>{
            if(err==null){
                // console.log("GOT RESPONSE FROM AI ENGINE");

                if(body.result.action==="input.unknown"){
                    // console.log("Escalation required");
                    this.escalationIndicator=true;
                }else{
                    // console.log("NLP required");
                    this.escalationIndicator=false;
                }
            }else{
                console.error("ERROR IN AI ENGINE CONNECTOR");
            }
            callback(this.escalationIndicator,err)
        })
    }
    
}

module.exports = aiEngine;