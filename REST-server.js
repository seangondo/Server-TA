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
    var sql = `SELECT * FROM caregiver_list WHERE (username="${req.body.username}" OR email="${req.body.username}") AND password="${req.body.password}"`;
    var cmdResult = false;
    
    //Caregiver Details
    var id = '';
    var name = '';
    var username = '';
    var email = '';
    var phone_number = '';
    var address = '';

    var data_send = '';
    let query = conn.query(sql, data, (err, result)=>{
        if (err) throw err;
        console.log(result.length);
        if(result.length !== 0) {
            cmdResult = true;
            id = result[0]['caregiver_id'];
            name = result[0]['name'];
            username = result[0]['username'];
            email = result[0]['email'];
            phone_number = result[0]['phone_number'];
            address = result[0]['address'];
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
                        "watch_id": "${result[i]['watch_id']}",
                        "image": "${result[i]['image']}"
                    }`
                }
                data_send += `]`
                res.send(`{"id": ${id}, "name": "${name}", "username": "${username}", "email": "${email}", "phone_number": "${phone_number}", "address": "${address}", "command": "login", "result": ${cmdResult}, ${data_send}}`);
            });
        } else {
            cmdResult = false;
            res.send(`{"id": null, "username": "${req.body.username}", "email": null, "phone_number": null, "command": "login", "result": ${cmdResult}}`);
        }
    })
});


 app.listen(8000,()=>{
    console.log('Server Running \nIP\t: localhost \nPort\t: 8000\n\n');
});

// TODO apps get sensors data etc