
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
const upload2 = multer();
const mysql = require('mysql2');
const { log } = require('console');

app.use(bodyParser.json()); 

// for parsing application/x-www-form-urlencoded
// app.use(express.urlencoded({ extended: true })); 

// // for parsing multipart/form-data
// app.use(upload2.array()); 
// app.use(express.static('public'));



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
    var sql = `SELECT elder_list.*, smarthome_table.* FROM elder_list 
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
            let sql = `INSERT INTO wearable_table (watch_id, sensor) VALUES ('${req.params.id}', '${req.params.sensor}');`
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
    let sql = `SELECT * FROM map_center WHERE house_id='${req.params.houseid}' AND coord_name !="" AND coord_name IS NOT NULL ORDER BY house_id ASC, coord_x ASC, coord_y ASC;`;
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
        address: req.body.address,
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
            let sql2 = `SELECT * FROM smarthome_table WHERE house_id='${data.house_id}'`
            let query2 = conn.query(sql2, data, (err, result) => {
                if (err) throw err;
                if(result.length > 0) {
                    let sql3 = `UPDATE smarthome_table SET 
                    address='${data.address}' WHERE house_id='${data.house_id}'`;
                    let query3 = conn.query(sql3, data, (err, result) => { 
                        if (err) throw err;
                    });
                } else {
                    let sql3 = `INSERT smarthome_table (house_id, address) VALUES (
                        '${data.house_id}',
                        '${data.address}'
                    );`
                    let query3 = conn.query(sql3, data, (err, result) => { 
                        if (err) throw err;
                    });
                }
            })
            res.send(`{"result": "berhasil"}`);
        })
    } else {
        res.send(`{"result": "gagal"}`);
    }
});

// EDIT ELDER DATA W/O IMAGE
app.post('/elder/edit', upload.array(), function (req, res) {
    console.log(req.body)
    let data = {
        id: req.body.id,
        name: req.body.name,
        birthdate: req.body.birthdate,
        house_id: req.body.house_id,
        address: req.body.address,
        robot_id: req.body.robot_id,
        watch_id: req.body.watch_id
    };
    let sql= `UPDATE elder_list SET 
    name='${data.name}', 
    birthdate='${data.birthdate}', 
    house_id='${data.house_id}', 
    robot_id='${data.robot_id}', 
    watch_id='${data.watch_id}' WHERE elder_id=${data.id};`;
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        let sql2 = `SELECT * FROM smarthome_table WHERE house_id='${data.house_id}'`
        let query2 = conn.query(sql2, data, (err, result) => {
            if (err) throw err;
            if(result.length > 0) {
                let sql3 = `UPDATE smarthome_table SET 
                address='${data.address}' WHERE house_id='${data.house_id}'`;
                let query3 = conn.query(sql3, data, (err, result) => { 
                    console.log("MASOK 1");
                    if (err) throw err;
                });
            } else {
                let sql3 = `INSERT smarthome_table (house_id, address) VALUES (
                    '${data.house_id}',
                    '${data.address}'
                );`
                let query3 = conn.query(sql3, data, (err, result) => { 
                    console.log("MASOK 2");
                    if (err) throw err;
                });
            }
        })
        res.send(`{"result": "berhasil"}`);
    })
});

// INSERT ELDER DATA WITH IMAGE
app.post('/elder/insert/img', upload.single('elder_image'), function (req, res) {
    let data = {
        caregiver_id: req.body.id,
        name: req.body.name,
        birthdate:req.body.birthdate,
        house_id:req.body.house_id,
        address: req.body.address,
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
        );`;
        let query = conn.query(sql, data, (err, result) => {
            if (err) throw err;
            let sql1 = `INSERT INTO elder_caregiver (caregiver_id, elder_id) VALUES (${data.caregiver_id}, ${result.insertId})`
            let query1 = conn.query(sql1, data, (err, result) => { 
                if (err) throw err;
                let sql2 = `SELECT * FROM smarthome_table WHERE house_id='${data.house_id}'`
                let query2 = conn.query(sql2, data, (err, result) => {
                    if (err) throw err;
                    if(result.length > 0) {
                        let sql3 = `UPDATE smarthome_table SET 
                        address='${data.address}' WHERE house_id='${data.house_id}'`;
                        let query3 = conn.query(sql3, data, (err, result) => { 
                            if (err) throw err;
                        });
                    } else {
                        let sql3 = `INSERT smarthome_table (house_id, address) VALUES (
                            '${data.house_id}',
                            '${data.address}'
                        );`
                        let query3 = conn.query(sql3, data, (err, result) => { 
                            if (err) throw err;
                        });
                    }
                })
            });
            res.send(`{"result": "berhasil"}`);
        })
    } else {
        res.send(`{"result": "error"}`);
    }
});

// ADD ELDER DATA W/O IMAGE
app.post('/elder/insert', upload.array(), function (req, res) {
    let data = {
        caregiver_id: req.body.id,
        name: req.body.name,
        birthdate:req.body.birthdate,
        house_id:req.body.house_id,
        address: req.body.address,
        robot_id:req.body.robot_id,
        watch_id:req.body.watch_id
    };
    let sql= `INSERT INTO elder_list (name, birthdate, house_id, robot_id, watch_id, image) VALUES (
        '${data.name}', 
        '${data.birthdate}', 
        '${data.house_id}', 
        '${data.robot_id}', 
        '${data.watch_id}', 
        'empty.jpg'
    );`;
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result.insertId)
        let sql1 = `INSERT INTO elder_caregiver (caregiver_id, elder_id) VALUES (${data.caregiver_id}, ${result.insertId})`
        let query1 = conn.query(sql1, data, (err, result) => { 
            let sql2 = `SELECT * FROM smarthome_table WHERE house_id='${data.house_id}'`
            let query2 = conn.query(sql2, data, (err, result) => {
                if(result.length > 0) {
                    let sql3 = `UPDATE smarthome_table SET 
                    address='${data.address}' WHERE house_id='${data.house_id}'`;
                    let query3 = conn.query(sql3, data, (err, result) => { 
                        if (err) throw err;
                    });
                } else {
                    let sql3 = `INSERT smarthome_table (house_id, address) VALUES (
                        '${data.house_id}',
                        '${data.address}'
                    );`
                    let query3 = conn.query(sql3, data, (err, result) => { 
                        if (err) throw err;
                    });
                }
            })
            res.send(`{"result": "berhasil"}`);
        });  
    })
});

// DELETE ELDER FROM CAREGIVER
app.post('/elder/delete', upload.array(), function (req, res) {
    let data = {
        caregiver_id: req.body.caregiver_id,
        elder_id: req.body.elder_id
    };

    let sql = `DELETE FROM  elder_caregiver WHERE caregiver_id=${data.caregiver_id} AND elder_id=${data.elder_id};`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        res.send(`{"result": "berhasil"}`);
    })
});

// ADD ELDER FROM ID
app.post('/caregiver/elder',  upload.array(), function (req, res) {
    let data = {
        caregiver_id: req.body.caregiver_id,
        elder_name: req.body.elder_name,
        elder_id: req.body.elder_id,
    }

    let sql = `SELECT * FROM elder_list WHERE name='${data.elder_name}' AND elder_id='${data.elder_id}';`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        if(result.length > 0) {
            let sql1 = `INSERT INTO elder_caregiver (caregiver_id, elder_id) VALUES 
            ('${data.caregiver_id}', '${data.elder_id}');`
            let query = conn.query(sql1, data, (err, result) => {
                if (err) throw err;
                res.send(`{
                    "result": "berhasil"
                }`);
            });
        } else {
            res.send(`{
                "result": "gagal"
            }`);
        }
    });
});

// ADD CAREGIVER ACCOUNT
app.post('/caregiver/signup', upload.array(), function (req, res) {
    let data = {
        name: req.body.name,
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address
    };

    let sql = `SELECT * FROM caregiver_list WHERE username='${data.username}' OR email='${data.email}';`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        var username = false;
        var email = false;
        if(result.length < 1) {
            let sql1 = `INSERT INTO caregiver_list (name, username, email, password, phone_number, address) VALUES(
                '${data.name}',
                '${data.username}',
                '${data.email}',
                '${data.password}',
                '${data.phone}',
                '${data.address}'
            );`
            let query1 = conn.query(sql1, data, (err, result) => {
                if (err) throw err;
                res.send(`{"result": "berhasil"}`);
            })
        } else {
            for(var i = 0; i < result.length; i++) {
                if(data.username == result[i]['username']){
                    username = true;
                }
                if(data.email == result[i]['email']){
                    email = true;
                }
            }
            res.send(`{
                "result": "gagal",
                "username": ${username},
                "email": ${email}
            }`);
        }
    })
});

// EDIT CAREGIVER ACCOUNT
app.post('/caregiver/edit', upload.array(), function (req, res) {
    let data = {
        id: req.body.id,
        name: req.body.name,
        username: req.body.username,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address
    };

    console.log(data);

    let sql = `SELECT * FROM caregiver_list WHERE (username='${data.username}' OR email='${data.email}') AND caregiver_id!=${data.id};`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        var username = false;
        var email = false;
        if(result.length < 1) {
            let sql1 = `UPDATE caregiver_list SET 
                name='${data.name}',
                username='${data.username}',
                email='${data.email}',
                phone_number='${data.phone}',
                address='${data.address}' WHERE caregiver_id = ${data.id};`
            let query1 = conn.query(sql1, data, (err, result) => {
                if (err) throw err;
                res.send(`{"result": "berhasil"}`);
            })
        } else {
            for(var i = 0; i < result.length; i++) {
                if(data.username == result[i]['username']){
                    username = true;
                }
                if(data.email == result[i]['email']){
                    email = true;
                }
            }
            res.send(`{
                "result": "gagal",
                "username": ${username},
                "email": ${email}
            }`);
        }
    })
});

// EDIT CAREGIVER PASSWORD
app.post('/caregiver/edit/password', upload.array(), function (req, res) {
    let data = {
        id: req.body.id,
        username: req.body.username,
        passOld: req.body.passwordOld,
        passNew: req.body.passwordNew
    };

    let sql = `SELECT * FROM caregiver_list WHERE username='${data.username}' 
        AND password='${data.passOld}' 
        AND caregiver_id=${data.id};`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result)
        if(result.length > 0) {
            let sql1 = `UPDATE caregiver_list SET 
                password='${data.passNew}' 
                WHERE username='${data.username}' AND password='${data.passOld}' AND caregiver_id=${data.id};`
            let query1 = conn.query(sql1, data, (err, result) => {
                if (err) throw err;
                console.log("MASOK")
                res.send(`{"result": "berhasil"}`);
            })
        } else {
            res.send(`{
                "result": "gagal"
            }`);
        }
    })
});

// EDIT CAREGIVER PASSWORD
app.post('/caregiver/edit/password', upload.array(), function (req, res) {
    let data = {
        id: req.body.id,
        username: req.body.username,
        passOld: req.body.passwordOld,
        passNew: req.body.passwordNew
    };

    let sql = `SELECT * FROM caregiver_list WHERE username='${data.username}' 
        AND password='${data.passOld}' 
        AND caregiver_id=${data.id};`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result)
        if(result.length > 0) {
            let sql1 = `UPDATE caregiver_list SET 
                password='${data.passNew}' 
                WHERE username='${data.username}' AND password='${data.passOld}' AND caregiver_id=${data.id};`
            let query1 = conn.query(sql1, data, (err, result) => {
                if (err) throw err;
                console.log("MASOK")
                res.send(`{"result": "berhasil"}`);
            })
        } else {
            res.send(`{
                "result": "gagal"
            }`);
        }
    })
});


// GET ALARM LOG
app.get('/alarm/log/:id', function (req, res) {
    let data = {
        id: req.params.id
    };

    let sql = `SELECT * FROM alarm_log WHERE elder_id='${data.id}' ORDER BY date DESC, time DESC;`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(result);
    })
});

// GET ALARM LOG COUNT
app.get('/alarm/count/:id', function (req, res) {
    let data = {
        id: req.params.id
    };

    let sql = `SELECT COUNT(elder_id) as n FROM alarm_log WHERE elder_id='${data.id}' AND status=1 ;`
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(result[0]);
    })
});

// UPDATE LOG
app.post('/alarm/update', upload.array(), function (req, res) {
    console.log("update request");
    let data = {
        id: req.body.id,
        date: req.body.date,
        time: req.body.time,
        type: req.body.type,
        status: req.body.status,
        message: req.body.message
    };
    let sql= `UPDATE alarm_log SET 
        status = '0' WHERE 
        elder_id = ${data.id} AND 
        date = '${data.date}' AND 
        time = '${data.time}' AND 
        type = '${data.type}' AND 
        message = '${data.message}';`;
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(`{"result": "berhasil"}`);
    })
});

// DELETE ALARM LOG COUNT
app.post('/alarm/delete', upload.array(), function (req, res) {
    let data = {
        id: req.body.id,
        date: req.body.date,
        time: req.body.time,
        type: req.body.type,
        status: req.body.status,
        message: req.body.message
    };

    let sql = `DELETE FROM alarm_log WHERE 
        elder_id = ${data.id} AND 
        date = '${data.date}' AND  
        time = '${data.time}' AND  
        type = '${data.type}' AND 
        message = '${data.message}';`;
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(`{"result": "berhasil"}`);
    })
});

//DELETE ALL ALARM
app.post('/alarm/clear', upload.array(), function (req, res) {
    let data = {
        id: req.body.id
    };

    let sql = `DELETE FROM alarm_log WHERE 
        elder_id=${data.id};`;
    let query = conn.query(sql, data, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.send(`{"result": "berhasil"}`);
    })
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