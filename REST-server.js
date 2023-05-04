
const express = require('express');
const multer = require("multer");
const https = require("https");
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();

const path = require("path");
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, '/home/pi/website/image');
        // cb(null, "uploads");
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({storage});
const mysql = require('mysql2');
const { log } = require('console');
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


 // LOGIN POST
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
            var sql = `SELECT * FROM elder_list 
                LEFT JOIN smarthome_table
                ON elder_list.house_id = smarthome_table.house_id
                INNER JOIN elder_caregiver 
                ON elder_list.elder_id = elder_caregiver.elder_id
                WHERE elder_caregiver.caregiver_id=${result[0]['caregiver_id']}`;
            //var sql = `SELECT * FROM elder_list INNER JOIN elder_caregiver ON elder_list.elder_id = elder_caregiver.elder_id WHERE elder_caregiver.caregiver_id=${result[0]['caregiver_id']}`;
            let query = conn.query(sql, data, (err, result)=>{
                if (err) throw err;
                data_send += `"elder_list": [`
                for(var i = 0; i < result.length; i++) {
                    if(i != 0) data_send += ',';
                    data_send += `{
                        "elder_id": ${result[i]['elder_id']},
                        "name": "${result[i]['name']}",
                        "address": "${result[i]['address']}",
                        "birthdate": "${result[i]['birthdate']}",
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

// GET ELDER UPDATE
app.get('/apps/elder/data/:id', (req,res) => {
    console.log("Masok awal!")
    var data_send = '';
    var sql = `SELECT * FROM elder_list 
    LEFT JOIN smarthome_table
    ON elder_list.house_id = smarthome_table.house_id
    INNER JOIN elder_caregiver 
    ON elder_list.elder_id = elder_caregiver.elder_id
    JOIN caregiver_list 
    ON caregiver_list.caregiver_id = elder_caregiver.caregiver_id
    WHERE caregiver_list.username='${req.params.id}'`;
    let query = conn.query(sql, (err, result)=>{
        if (err) throw err;
        data_send += `[`
        for(var i = 0; i < result.length; i++) {
            if(i != 0) data_send += ',';
            data_send += `{
                "elder_id": ${result[i]['elder_id']},
                "name": "${result[i]['name']}",
                "address": "${result[i]['address']}",
                "birthdate": "${result[i]['birthdate']}",
                "house_id": "${result[i]['house_id']}",
                "robot_id": "${result[i]['robot_id']}",
                "watch_id": "${result[i]['watch_id']}",
                "image": "${result[i]['image']}"
            }`
        }
        data_send += `]`;
        console.log(data_send);
        res.send(data_send);
    });
});

 // GET SENSOR
app.get('/apps/caregiver/get-sensor/:house_id', (req, res)=>{
    var sql = `SELECT * FROM db_sensor WHERE house_id='${req.params.house_id}';`;
    let query = conn.query(sql, (err, result)=>{
        if (err) throw err;
        var response = '';
        response += '['
        for(var i = 0; i < result.length; i++) {
            if (i != 0) response += ',';
            response += `{
                "house_id": "${result[i]['house_id']}",
                "room": "${result[i]['room']}",
                "sensor_type": "${result[i]['sensor_type']}",
                "trend": "${result[i]['trend']}"
            }`
        }
        response += ']'
        res.send(response);
    })
});

// GET BUTTON
app.get('/apps/caregiver/get-button/:house_id', (req, res)=>{
    var sql = `SELECT * FROM db_sensor WHERE house_id='${req.params.house_id}';`;
    let query = conn.query(sql, (err, result)=>{
        if (err) throw err;
        var response = '';
        response += '['
        for(var i = 0; i < result.length; i++) {
            if (i != 0) response += ',';
            response += `{
                "house_id": "${result[i]['house_id']}",
                "room": "${result[i]['room']}",
                "button_type": "${result[i]['sensor_type']}"
            }`
        }
        response += ']'
        res.send(response);
    })
});

// GET Watch ID
app.get('/wearable/get_id/:id/:sensor', (req,res) => {
    let sql = `SELECT * FROM wearable_table WHERE watch_id='${req.params.id}'`
    let query = conn.query(sql, (err, result)=>{
        if (err) throw err;
        if(result.length == 0) {
            let sql = `INSERT INTO wearable_table (watch_id, sensor) VALUES ('${req.params.id}', '${req.params.id}');`
            let query = conn.query(sql, (err, result)=>{
                if (err) throw err;
            });
        }
        response = `{
            "watch_id": "${req.params.id}",
            "available": ${result.length}
        }`
        res.send(response);
    })
});

// GET POINT COORDINATE
app.get('/point/coordinate/:houseid', (req, res) => {
    let sql = `SELECT * FROM map_center WHERE house_id='${req.params.houseid}' ORDER BY house_id ASC, coord_x ASC, coord_y ASC;`;
    let query = conn.query(sql, (err, result) => {
        if (err) throw err;
        res.send(result);
    })
}) 

// EDIT ELDER DATA WITH IMAGE
app.post('/elder/edit/img', upload.single('elder_image'), function (req, res) {
    let data = {
        id: req.body.id,
        name: req.body.name,
        birthdate:req.body.birthdate,
        house_id:req.body.house_id,
        robot_id:req.body.robot_id,
        watch_id:req.body.watch_id
    };
    const file = req.file;

    if(file) {
        console.log(file.originalname);
        let sql= `UPDATE elder_list SET 
        name='${data.name}', 
        birthdate='${data.birthdate}', 
        house_id='${data.house_id}', 
        robot_id='${data.robot_id}', 
        watch_id='${data.watch_id}', 
        image='${file.originalname}' WHERE elder_id=${data.id};`;
        let query = conn.query(sql, data, (err, result) => {
            if (err) throw err;
            res.send("berhasil");
        })
    } else {
        res.send("error");
    }
});

// EDIT ELDER DATA W/O IMAGE
app.post('/elder/edit', function (req, res) {
    let data = {
        id: req.body.id,
        name: req.body.name,
        birthdate:req.body.birthdate,
        house_id:req.body.house_id,
        robot_id:req.body.robot_id,
        watch_id:req.body.watch_id
    };
    const file = req.file;

    if(file) {
        console.log(file.originalname);
        let sql= `UPDATE elder_list SET 
        name='${data.name}', 
        birthdate='${data.birthdate}', 
        house_id='${data.house_id}', 
        robot_id='${data.robot_id}', 
        watch_id='${data.watch_id}' WHERE elder_id=${data.id};`;
        let query = conn.query(sql, data, (err, result) => {
            if (err) throw err;
            res.send("berhasil");
        })
    } else {
        res.send("error");
    }
});


// ADD ELDER DATA
app.post('/elder/add', upload.single('elder_image'), function (req, res) {
    let data = {
        id: req.body.id,
        name: req.body.name,
        birthdate:req.body.birthdate,
        house_id:req.body.house_id,
        robot_id:req.body.robot_id,
        watch_id:req.body.watch_id
    };
    const file = req.file;

    if(file) {
        console.log(file.originalname);
        let sql= `INSERT INTO elder_list (name, birthdate, house_id, robot_id, watch_id, image) VALUES (
            '${data.name}',
            '${data.birthdate}',
            '${data.house_id}',
            '${data.robot_id}',
            '${data.watch_id}',
            '${file.originalname}'
        )`;
        let query = conn.query(sql, data, (err, result) => {
            if (err) throw err;
            res.send("berhasil");
        })
    } else {
        res.send("error");
    }
});

function pingdb() {
var sql_keep = `SELECT 1 + 1 AS solution`; 
conn.query(sql_keep, function (err, result) {
    if (err) throw err;
    console.log("Ping DB");
});
}
setInterval(pingdb, 40000);


https
  .createServer(
		// Provide the private and public key to the server by reading each
		// file's content with the readFileSync() method.
    {
      key: fs.readFileSync("/home/pi/sslKey/privkey.pem"),
      cert: fs.readFileSync("/home/pi/sslKey/fullchain.pem"),
    },
    app
  )
  .listen(8000, () => {
    console.log("server is runing at port 8000");
  });

//  app.listen(8000,()=>{
//     console.log('Server Running \nIP\t: localhost \nPort\t: 8000\n\n');
// });