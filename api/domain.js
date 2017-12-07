var request = require("request");

class agent{
    constructor(accNo,userName,pass){
        this.accNo=accNo;
        this.userName=userName;
        this.pass=pass;
    }
    
    domain(callback){
        var options = { 
            method: 'GET',
            url: "http://api.liveperson.net/api/account/"+this.accNo+"/service/agentVep/baseURI.json",
            qs: { 
              version: '1.0'
           },
          headers:{
              'postman-token': 'bfddf5d8-eb8d-babd-64a6-0f76bdd1625f',
               'cache-control': 'no-cache' 
            } 
        };
      
      request(options, function (error, response, body) {
        if (error) throw new Error(error);
      
        // console.log(body);
        var data=JSON.parse(body)
        callback(data.baseURI);
      });

    }

    login(baseusri,callback){
        
        var options = { 
            method: 'POST',
            url: 'https://'+baseusri+'/api/account/15341746/login',
            qs: { v: '1.3' },
        headers: {
             'postman-token': 'c41aa00a-2118-d3e9-f112-8afdc1e94ed1',
             'cache-control': 'no-cache',
             accept: 'application/json',
             'content-type': 'application/json'
             },
        body: {
               username: 'bot', 
               password: 'sectorsix6' 
            },
          json: true };
        
        request(options, function (error, response, body) {
          if (error) throw new Error(error);
        
        //   console.log(body);
        callback(body);
        });
    }
}




var ob = new agent(15341746,"bot","sectorsix6");
ob.domain((baseURI)=>{
    console.log(baseURI);
    ob.login(baseURI,(data)=>{
        console.log(JSON.stringify(data));
    })

}) 