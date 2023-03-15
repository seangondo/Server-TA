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

var totalSensor = 0;

const sum = [];
const val = [];
const hslAvg = [];

const trendType = [];
const trendSum = [];
const trend = [];
const trendAvg = [];

const db_username = [];
let db_houseID = [];
const userData = [];
const robot_ID = [];

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
    let sql = `SELECT * FROM client_table`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        for(i = 0; i < result.length; i++){
            db_username[i] = result[i]['username'];
            
            userData[`${db_username[i]}`] = result[i]['house_id'];
            robot_ID[`${db_username[i]}`] = result[i]['robot_id'];
            db_houseID = db_houseID.concat(result[i]['house_id']);
            if(db_houseID[count] == db_houseID[count-1]) {
                console.log("MASOK");
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
                // sum['10001'] = sum['10001'].concat(0)
                // console.log(sum['10001'][7])
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }
    });
})


//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('message', function(topic, message) {

    splitTopic('/'+topic+'/', message);
    // console.log("Msg : "+message);

});


function splitTopic(topic, value) {
    var arrObj = []
    var i = 0;
    var index = 0;
    // console.log('\n\nStarting Splice Num : ' + count);
    while (index != -1) { 
        var start = index + 1;
        index = topic.indexOf('/', index + 1);
        // console.log(index);
        if(index != -1) {
            arrObj[i] = topic.substring(start, index)
            i++;
        } else {
            break;
        }
    }
    checkDb(arrObj);

}

function checkDb(data) {
    if(data[1] == 'receive_sensor') {
        varCheck(data[0]);
        let sql = `SELECT COUNT(house_id) AS n FROM db_sensor WHERE house_id='${data[0]}' AND room='${data[2]}' AND sensor_type='${data[3]}'`;
        let query = conn.query(sql, (err,result)=>{
            if (err) throw err;
            if (result[0]['n'] == 0) {
                addSensorDb(data);

            }
        });
    }
}

function addSensorDb(data) {
    let sql = `INSERT INTO db_sensor (house_id, room, sensor_type) VALUES ('${data[0]}', '${data[2]}', '${data[3]}') `;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
    });
}

function varCheck(id) {
    let sql = `SELECT COUNT(house_id) AS n FROM db_sensor WHERE house_id='${id}'`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        if(totalSensor != result[0]['n']) {
            totalSensor = result[0]['n'];
            for(i = 0; i < totalSensor; i++){
                woke = woke.concat(0);
            }
        }
    });
}