const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mysql = require('mysql2');

app.use(bodyParser.json());

/*---------------< Connect MySql >---------------*/
const conn = mysql.createConnection({
    host: 'private-server.uk.to',
    user: 'admin',
    password : 'randpwsocool',
    database : 'elderly_care',
    multipleStatements : true,
});

conn.connect((err)=>{
    if (err) throw err;
    console.log('Mysql connected...');
});

app.get('/',function(req,res){
    console.log("Got a GET request");
    res.send('[]');
 }); //Untuk Debug Koneksi, bisa untuk login kalo null

app.post('/apps/caregiver/login', (req,res) => {
    let data = {username: req.body.username, password:req.body.password};
    var sql = `SELECT caregiver_id FROM caregiver_list WHERE username="${req.body.username}" AND password="${req.body.password}"`;
    var cmdResult = false;
    var data_send = '';
    let query = conn.query(sql, data, (err, result)=>{
        if (err) throw err;
        console.log(result.length);
        if(result.length !== 0) {
            cmdResult = true;
            var sql = `SELECT * FROM elder_list INNER JOIN elder_caregiver ON elder_list.elder_id = elder_caregiver.elder_id WHERE elder_caregiver.caregiver_id=${result[0]['caregiver_id']}`;
            let query = conn.query(sql, data, (err, result)=>{
                if (err) throw err;
                data_send += `"elder_list": [`
                for(var i = 0; i < result.length; i++) {
                    if(i != 0) data_send += ',';
                    data_send += `{
                        "elder_id": ${result[i]['elder_id']},
                        "name": "${result[i]['name']}",
                        "address": "${result[i]['address']}",
                        "house_id": "${result[i]['house_id']}",
                        "robot_id": "${result[i]['robot_id']}",
                        "watch_id": "${result[i]['watch_id']}"
                    }`
                }
                data_send += `]`
                res.send(`{"username": "${req.body.username}", "command": "login", "result": ${cmdResult}, ${data_send}}`);
            });
        } else {
            cmdResult = false;
            res.send(`"username": "${req.body.username}", "command": "login", "result": ${cmdResult}`);
        }
    })
});


 app.listen(8000,()=>{
    console.log('Server Running \nIP\t: localhost \nPort\t: 8000\n\n');
});