var constants = require('./db.config');
var oracledb = require('oracledb');
var sql = require("mssql");

var lstSQLdocs = [];
var lstSQLstats = [];

function modifyDate(inputDate) {
    if (!inputDate) {
        return inputDate;
    };
    var a = new Date(inputDate);
    var dateStr = [ addLeadZero(a.getDate(),2), addLeadZero(a.getMonth() + 1,2), a.getFullYear(),
              ].join('.') 
              + ' ' +
              [ addLeadZero(a.getHours(),2), addLeadZero(a.getMinutes(),2),  addLeadZero(a.getSeconds(),2),
                addLeadZero(a.getMilliseconds(),3) 
              ]. join(':');

    return dateStr;
}


function addLeadZero(val, zeroCount) {
        switch (zeroCount){
                case 3: if (+val < 10) {return '00' + val;}
                        else if (+val < 100) {return '0' + val;}  
                        break;
                case 2: if (+val < 10) return '0' + val; break;
        }
        return val;
};


function createCurrentDate(makeBegin){
    let newDate = new Date();
    let genDate = addLeadZero(newDate.getDate(),2) + ":" + addLeadZero((newDate.getMonth()+1),2) + 
                  ":" + newDate.getFullYear();

    (makeBegin) ? genDate+=(" 00:00:01") :  genDate+=(" 23:59:59");

    return genDate;
}


function replaceAll(str, find, replace) {
    function escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}


async function getMSSQLData(sDocsList, lstStat, callback){
    
    sql.connect(constants.configMSSQL, function (err) {

    if (err) {
         console.log(err);
         res.send({ message: "Ошибка соединения с MQ SQL", error: 500 });
    }
    let request = new sql.Request(); 
    let sQuery = `select tsk.mw_id, tsk_state.statusID
                  from MedworkData.dbo.egiszTasks as tsk 
                  left outer join MedworkData.dbo.egiszTaskStatus as tsk_state on tsk_state.MasterID = tsk.ID
                  left outer join MedworkData.dbo.egiszTaskStatusDict as state_dict on state_dict.ID = tsk_state.statusID
                  where tsk.mw_id in ` + sDocsList;

    let substrStates = ` and tsk_state.statusID in (:LST_STATES) `;
    let endSQLstring = ` order by tsk.mw_id,tsk_state.status_date`;
    if (lstStat) {sQuery = sQuery + replaceAll(substrStates, ":LST_STATES", lstStat);}
    sQuery+=endSQLstring;

    request.query(sQuery)
           .then(data => {
                    console.log('Request ok...');

                    lstSQLdocs = [];
                    lstSQLstats = [];
                    let lstPartStats = [];
                    let old_id = -1;
                    let new_id = 0;

                    data.recordset.forEach( (item, i)=>{
                        new_id = item.mw_id;
                        if (new_id != old_id){ 
                            if (old_id != -1) {
                                lstSQLdocs.push(old_id);
                                lstSQLstats.push(lstPartStats);
                            };
                            lstPartStats = [];
                            lstPartStats.push(item.statusID);
                            old_id = new_id; 
                        }
                        else {
                            lstPartStats.push(item.statusID);
                        }      
                    });
                    lstSQLdocs.push(old_id);
                    lstSQLstats.push(lstPartStats); // записать последний элемент

                    callback(); //-!
                    return 0;
           })
           .then(()=>sql.close())
           .catch(error => {
                    console.error(error);
                    res.send({ message: "Error execute SQL script...", error: 500 });
           })
    });
}


async function getListDocs(dateBegin, dateEnd, lstStat, lstAuthor, res){
    let sQuery = formateSQLstring(dateBegin, dateEnd, lstAuthor);
    let connectionOra = await oracledb.getConnection(constants.configOra);
    
    
    try {
        let queryResult = await connectionOra.execute(sQuery);                      
        if (queryResult.rows.length === 0) {
            await connectionOra.close();
            console.error("No results");
            res.send({ message: "Документы не найдены", error: 404 });
            return -1;
        }
        else {
            await connectionOra.close();
            let sDocsList = "(";
            queryResult.rows.forEach( (item, i)=>{
                if (i==queryResult.rows.length-1) {sDocsList+=item[6]+")"} else {sDocsList+=item[6]+","}
            });

            await getMSSQLData(sDocsList, lstStat, function(){

                if (lstStat) { // Статусы определены, отдать пересечение списков
                    queryResult.rows = queryResult.rows.filter(function(item, key) {
                        if (lstSQLdocs.indexOf(item[6]) != -1) {item[8] = lstSQLstats[lstSQLdocs.indexOf(item[6])]}
                        return ~lstSQLdocs.indexOf(item[6])
                    })
                } else { // Статусы не определены, отдать то, чего нет в списке из MW
                    queryResult.rows = queryResult.rows.filter(function(item, key) {
                        return !~lstSQLdocs.indexOf(item[6])
                    })
                }
                // Приведение даты к формату DD:MM:YYYY HH:MM:SS:MS
                queryResult.rows.forEach( (item, i)=>{
                    item[3] = modifyDate(item[3]);
                    item[4] = modifyDate(item[4]);
                });

                var queryResultJSON = JSON.stringify(queryResult);
                res.send(queryResultJSON);
            });
            return 0; 
        }
    } catch (e) {
        console.error(e);
        return -1;
    }

    return;
}


function formateSQLstring(dateBegin, dateEnd, lstAuthor){
    let sQuery = `select docs.nom_kart as idcard, docs.nom_pos as idpos, t.family_name || ' ' || t.name || ' ' || t.patronymic as patfio,
                docs.DATE_CREAT date_creat, docs.DATE_EDIT date_edit,
                sotr.family_name || ' ' || substr(sotr.name,1,1) || '.' || substr(sotr.patronymic,1,1) || '.' as docfio,
                docs.ID_IN_MW_REESTR as id_doc_mw, pats.PATID as id_pat_mw, NULL as list_states 
                from medbase.mw_docs_list_work docs
                left outer join old_medbase.titlist t on (t.id_card=docs.nom_kart)
                left outer join medbase.mw_patients_work pats on (pats.nom_kart = docs.nom_kart)
                left outer join medbase.kl_sotr sotr on (sotr.ID_SOTR = docs.KOD_CREAT)
                where ( docs.DATE_CREAT between to_date(\':DATE1\', \'DD.MM.YYYY HH24:MI:SS\') and to_date(\':DATE2\', \'DD.MM.YYYY HH24:MI:SS\') or 
                        docs.DATE_EDIT between to_date(\':DATE1\', \'DD.MM.YYYY HH24:MI:SS\') and to_date(\':DATE2\', \'DD.MM.YYYY HH24:MI:SS\')) 
                `; 
    let substrAuthos = `and ( (kod_creat in (:LST_AUTHORS)) or (kod_edit in (:LST_AUTHORS)) ) `;
    let endSQLstring = `and docs.ID_MW_DOC = 6 order by 1`;

    sQuery = replaceAll(sQuery, ":DATE1", dateBegin);
    sQuery = replaceAll(sQuery, ":DATE2", dateEnd);
    if (lstAuthor) {sQuery = sQuery + replaceAll(substrAuthos, ":LST_AUTHORS", lstAuthor);}
    sQuery+=endSQLstring;

    return sQuery;
}


module.exports.getListDocs = getListDocs;
module.exports.createCurrentDate = createCurrentDate;
module.exports.addLeadZero = addLeadZero;
module.exports.modifyDate = modifyDate;