const mqtt = require('mqtt');
//const ohmni = require('https://api.ohmnilabs.com/ohmni-api/Ohmni-standalone.js');
const mysql = require('mysql2');

var PI = 3.141592653589793238;

var task = false;
var task1 = false;
// var house_id = '10001';
// var user = 'user';

var sendTime = 2; //in Seconds

var count = 0;


var woke = [];

var sensorArr = [];

var totalSensor = [];

const sum = [];
const val = [];
const avg = [];

const trendType = [];
const trendSum = [];
const trend = [];
const trendAvg = [];

let db_houseID = [];
const userData = [];
const sensorData = [];

var trendSend = '';

var options={
    retain:true, 
    qos:0
};

const conn = mysql.createConnection({
    host: 'private-server.uk.to',
    user: 'admin',
    password : 'randpwsocool',
    database : 'elderly_care',
    multipleStatements : true,
});

//-------------------< Connection MQTT and MySQL >-------------------//
const client  = mqtt.connect('mqtt://private-server.uk.to:1883/', {
    username: 'sensor',
    password: 'sensor',
})

conn.connect((err)=>{
    if (err) throw err;
    console.log('Mysql connected...');
});

//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('connect', () => {
    var count = 0;
    let sql = `SELECT * FROM client_table ORDER BY house_id ASC`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        for(i = 0; i < result.length; i++){
            userData.push({'username': result[i]['username'], 'house_id': result[i]['house_id'], 'robot_id': result[i]['robot_id']});
            db_houseID = db_houseID.concat(result[i]['house_id']);
            if(db_houseID[count] == db_houseID[count-1]) {
                const x = db_houseID.pop();
            }
            count++;

            client.subscribe(`${result[i]['username']}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }
        
        for(i = 0; i < db_houseID.length; i++) {
            client.subscribe(`${db_houseID[i]}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
            totalSensor[db_houseID[i]] = 0;
        }
        sensorList();
    });

})



//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('message', function(topic, message) {
    var split = splitTopic('/'+topic+'/', message);
    checkDb(split);

    split[2]
    db_houseID;

    for(i = 0; i < db_houseID.length; i++) {
        if(split[0] == db_houseID[i]) {
            for(j = 0; j < sensorData.length; j++) {
                if(split[2] == sensorData[j]['room'] && split[3] == sensorData[j]['sensor_type']) {
                    
                }
            }
        }
    }

    // if(split[0] == sensorData[0]) {
    //     console.log('Msg ' + message)
    // }

    // console.log(userData);
    // console.log(sensorData);

    // for(i = 0; i < db_houseID.length; i++) {
    //     console.log(db_houseID[i])
    // }
});

function sensorList(){
    let sql = `SELECT * FROM db_sensor ORDER BY house_id ASC`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        for(i = 0; i < result.length; i++){
            sensorData.push({'house_id': result[i]['house_id'], 'room': result[i]['room'], 'sensor_type': result[i]['sensor_type']});
        }
    });
}

function splitTopic(topic, value) {
    var arrObj = []
    var i = 0;
    var index = 0;
    while (index != -1) { 
        var start = index + 1;
        index = topic.indexOf('/', index + 1);
        if(index != -1) {
            arrObj[i] = topic.substring(start, index)
            i++;
        } else {
            break;
        }
    }
    return arrObj;
    // console.log(woke.length);
}

function checkDb(data) {
    if(data[1] == 'receive_sensor') {
        let sql = `SELECT COUNT(house_id) AS n FROM db_sensor WHERE house_id='${data[0]}' AND room='${data[2]}' AND sensor_type='${data[3]}'`;
        let query = conn.query(sql, (err,result)=>{
            if (err) throw err;
            if (result[0]['n'] == 0) {
                addSensorDb(data);
            }
        });
        varCheck(data[0]);
    }
}

function addSensorDb(data) {
    let sql = `INSERT INTO db_sensor (house_id, room, sensor_type) VALUES ('${data[0]}', '${data[2]}', '${data[3]}') `;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
    });
}

function varCheck(id) {
    //let sql = `SELECT COUNT(house_id) AS n FROM db_sensor WHERE house_id='${id}'`;
    let sql = `SELECT * FROM db_sensor WHERE house_id='${id}'`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        // if(totalSensor != result[0]['n']) {
        if(totalSensor[id] !== result.length) {
            totalSensor[id] = result.length;
            for(i = 0; i < totalSensor[id]; i++) {
                sum.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
                val.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
                avg.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
            }
        }
    });
}

function avgVal(total, count) { 

}