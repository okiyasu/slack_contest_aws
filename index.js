// Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may not
// Use this file except in compliance with the License. A copy of the License is
// located at
//     http://aws.amazon.com/apache2.0/
//
// or in the "license" file accompanying this file. This file is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.
//
// slackからメッセージを受け取り、レスポンスを返す
// コマンド：sokoban stage
// slack公開指定で面データ取得してランダムに返す
//
// コマンド：sokoban stage idx
// slack公開指定で指定した面データ取得して返す
// ——————
// idx:ステージセットNo＋”-”+ステージNo
// ステージセット名＋面
// 面データ
// 作者
// ——————
// を返す。
//
// コマンド：sokoban solved
// 最近更新された最短手数を５つほど返す
//
// コマンド：sokoban solved idx
// 面の解答手数データ返す
// ——————
// 公式記録：記録保持者
// ===
// 解答者記録：解答者
// ・・・
// ——————
// で、登録あるだけ？　５件？　を返す。

const request = require('request');
const moment = require('moment');

const DOMAIN = 'xxxx.cybozu.com'; //kintone環境のドメイン
const BASE_URL = "https://" + DOMAIN + '/k/v1/';
const STAGE_APP_TOKEN = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const STAGE_APP_ID = 0;
const TRACE_APP_TOKEN = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const TRACE_APP_ID = 0;
const CREATE_APP_TOKEN = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const CREATE_APP_ID = 0;
const HISTORY_APP_TOKEN = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const HISTORY_APP_ID = 0;

const nothing_message = [
    '面データが見つからないよ・・・。面IDが正しいか確認してね。',
    '面データが見つからないので、面データが直るまでちょっと待ってね。'
];
const error_message = [
    '面データ読み取り時にエラーが発生しました。',
    'なんか、サーバーってのがおかしいんだって、中の人が直すまで待ってみて。'
];
const showstage_message = [
    'はい、どうぞ！\n',
    'この面であってるかなぁ？\n',
    'この面見たことある？\n'
];
const map_space = ' ',
    map_point = '.',
    map_box = '$',
    map_box_on_point = '*',
    map_rabi = '@',
    map_rabi_on_point = '+',
    map_block = '#',
    map_outside = '%',
    byte_space = 0b0000,
    byte_point = 0b0001,
    byte_box = 0b0010,
    byte_box_on_point = 0b0011,
    byte_rabi = 0b0100,
    byte_rabi_on_point = 0b0101,
    byte_block = 0b1000,
    byte_mask_space = 0b1110, //stage[pos] & map_mask_space > 0 -> 空白ではない
    byte_mask_box = 0b0010; //stage[pos] & map_mask_box > 0 -> 荷物あり（格納地点上の荷物含む）
const USAGE_TRACE = ' trace <StageID> udrlUDRL(Trace)';

function makeGEToptions(param) {
    var headers_token = { 'X-Cybozu-API-Token': param.token };
    var body = {
        app: param.appid,
        query: param.query,
        fields: param.fields
    };
    //生産者一覧アプリからレコードを取得する際のヘッダー
    var options = {
        url: BASE_URL + 'records.json',
        method: param.method,
        headers: headers_token,
        'Content-Type': 'application/json',
        json: body
    };
    return options;
}

function makePOSTPUToptions(param) {
    var headers_token = { 'X-Cybozu-API-Token': param.token };
    var body = {};
    if (param.method === 'POST') {
        // POST時
        body = {
            app: param.appid,
            record: param.record
        };
    } else {
        // PUT時
        body = {
            app: param.appid,
            id: param.id,
            record: param.record
        };
    }
    var options = {
        url: BASE_URL + 'record.json',
        method: param.method,
        headers: headers_token,
        'Content-Type': 'application/json',
        json: body
    };
    return options;
}

function makeNothingMessage(context, return_message) {
    var options_getsetname = {
        method: 'GET',
        token: STAGE_APP_TOKEN,
        appid: STAGE_APP_ID,
        query: 'slack in ("公開") ',
        fields: [
            '$id',
            'set_no',
            'set_name',
            'set_name_eng'
        ]
    };
    console.log('option : ' + JSON.stringify(options_getsetname));
    request(makeGEToptions(options_getsetname), function(error, response, body) {
        if (!error && response.statusCode === 200) {
            console.log('insert success response:', JSON.stringify(response, null, 2));
            console.log('insert success body:', JSON.stringify(body, null, 2));
            //レコードから面セット名取得
            return_message += '\n\nI know these SetName.';
            var records = body.records;
            var setname_list = [];
            var setname_eng_list = [];
            for (var i = 0; i < records.length; i++) {
                if (setname_eng_list.indexOf(records[i].set_name_eng.value) < 0) {
                    setname_eng_list.push(records[i].set_name_eng.value);
                    setname_list.push(records[i].set_name.value);
                }
            }
            for (var j = 0; j < setname_list.length; j++) {
                return_message += '\n"' + setname_eng_list[j] + '" / [' +
                    setname_list[j] + ']';
            }
            return_message += '\nIf you specify the SetName, you will see the StageID.';
            return_message += '\n\nUsage : sokobot stagelist SetName';
            context.done(null, { text: return_message });
        } else {
            //デバッグコード
            console.log('insert error response:', JSON.stringify(response, null, 2));
            console.log('insert error error:', JSON.stringify(error, null, 2));
            var message = '\nERROR : get records';
            context.done(null, { text: message });
        }
    });
}

function makeErrorMessage() {
    var idx = Math.floor(Math.random() * error_message.length);
    return '\n' + error_message[idx];
}

function makeShowstageMessage() {
    var idx = Math.floor(Math.random() * showstage_message.length);
    return '\n' + showstage_message[idx];
}

function makeStageInfo(record) {
    var info = '\nID:' + record.unique_name.value;
    info += '\nName:' + record.stage_name.value + ' [SetName : ' + record.set_name.value +
        '/' + record.set_name_eng.value + ' No.' + record.stage_no.value + ']';
    return info;
}

function makeMapdataInfo() {
    var message = '';
    message += '\n" " : Floor / "." : Storage';
    message += '\n"$" : Box   / "*" : Box on Storage';
    message += '\n"@" : Rabi  / "+" : Rabi on Storage';
    message += '\n"#" : Wall';
    return message;
}

function makeTracedataInfo() {
    var message = '';
    message += '\n"u" : UP    / "U" : UP and PUSH Box';
    message += '\n"d" : DOWN  / "D" : DOWN and PUSH Box';
    message += '\n"r" : RIGHT / "R" : RUGHT and PUSH Box';
    message += '\n"l" : LEFT  / "L" : UP and PUSH Box';
    return message;
}

function replaceAll(strBuffer, strBefore, strAfter) {
    return strBuffer.split(strBefore).join(strAfter);
}

function fixSquare(stage, joincode) {
    var lines = stage.split('\n');
    var x_max = 0;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i] === '') {
            continue;
        }
        if (x_max < lines[i].length) {
            x_max = lines[i].length;
        }
        var j = 0;
        while (lines[i][j] === map_space) {
            j++;
        }
        //マジックワードすぐる・・・。DBを整備すれば、処理を削減できる予定
        lines[i] = '%%%%%%%%%%%%%'.slice(0, j) + lines[i].slice(j);
        lines[i] = lines[i] + '%%%%%%%%%%%%%%%%%%%%%%%%%%';
    }
    for (var j = 0; j < lines.length; j++) {
        lines[j] = lines[j].slice(0, x_max);
    }
    return [lines.join(joincode), x_max];
}

function replaceCode(stage) {
    stage = replaceAll(stage, '%', ':outside:');
    stage = replaceAll(stage, '#', ':wall:');
    stage = replaceAll(stage, '.', ':point:');
    stage = replaceAll(stage, ' ', ':floor:');
    stage = replaceAll(stage, '$', ':box:');
    stage = replaceAll(stage, '@', ':rabi:');
    stage = replaceAll(stage, '*', ':boxpoint:');
    stage = replaceAll(stage, '+', ':rabipoint:');
    return stage;
}

function convertStage(stage) {
    stage = fixSquare(stage, '\n')[0];
    return '\n' + replaceCode(stage);
}

function getStage(body, param, context) {
    if (body.records && body.records.length === 0) {
        //レコードがない場合
        makeNothingMessage(context, "\nI don't know this StageID");
    } else if (!body.records) {
        //取得エラー時
        param.message += makeErrorMessage();
        context.done(null, { text: param.message });
    } else {
        var records = body.records;
        //レコードから面データ取得
        var idx = 0;
        if (body.records.length > 1) {
            //複数の時はランダムで選択。１件の時はidx=0
            idx = Math.floor(Math.random() * body.records.length);
        }
        param.message += makeShowstageMessage();
        param.message += makeStageInfo(records[idx]);
        param.message += convertStage(records[idx].stage.value);
        param.message += '\n' + records[idx].stage.value;
        param.message += '\nCreator : ' + records[idx].creator.value;
        context.done(null, { text: param.message });
    }
}

function getSolved(body, param, context) {
    if (body.records && body.records.length === 0) {
        //レコードがない場合
        makeNothingMessage(context, "\nI don't know this StageID");
    } else if (!body.records) {
        //取得エラー時
        param.message += makeErrorMessage();
        context.done(null, { text: param.message });
    } else {
        var records = body.records;
        //レコードから面データ取得
        var idx = 0;
        if (body.records.length > 1) {
            //複数の時はランダムで選択。１件の時はidx=0
            idx = Math.floor(Math.random() * body.records.length);
        }
        param.message += makeShowstageMessage();
        param.message += makeStageInfo(records[idx]);
        param.message += '\nRecord : ' + records[idx].record.value + ' Moves (Name : ' +
            records[idx].record_holder.value + ' )';
        var table_records = records[idx].Table.value;
        var records_list = [];
        for (var i = 0; i < table_records.length; i++) {
            if (table_records[i].value.solver.value === '') {
                continue;
            }
            var record = {
                'moves': parseInt(table_records[i].value.solver_record.value),
                'name': table_records[i].value.solver.value
            };
            records_list.push(record);
        }
        //手数の少ない順にソート
        records_list.sort(function(a, b) {
            if (a.moves < b.moves) return -1;
            if (a.moves > b.moves) return 1;
            return 0;
        });

        param.message += '\n--Another Records----------------------------------';
        if (records_list.length === 0) {
            param.message += '\nNothing...'
        }
        for (var j = 0; j < records_list.length; j++) {
            param.message += '\nRecord : ' + records_list[j].moves +
                ' Moves (Name : ' + records_list[j].name + ')';
        }
        //        param.message += '\n---------------------------------------------------';
        context.done(null, { text: param.message });
    }
}

function showStagelist(body, param, context) {
    if (body.records && body.records.length === 0) {
        //レコードがない場合
        makeNothingMessage(context, "\nI don't know this SetName");
    } else if (!body.records) {
        //取得エラー時
        param.message += makeErrorMessage();
        context.done(null, { text: param.message });
    } else {
        var records = body.records;
        var stage_list = [];
        //レコードから面データ取得
        for (var i = 0; i < records.length; i++) {
            var stage_data = {
                'stage_no': parseInt(records[i].stage_no.value),
                'unique_name': records[i].unique_name.value,
                'stage_name': records[i].stage_name.value
            };
            stage_list.push(stage_data);
        }
        //手数の少ない順にソート
        stage_list.sort(function(a, b) {
            if (a.stage_no < b.stage_no) return -1;
            if (a.stage_no > b.stage_no) return 1;
            return 0;
        });

        for (var j = 0; j < stage_list.length; j++) {
            param.message += '\nNo.' + stage_list[j].stage_no + ' : "' +
                stage_list[j].unique_name + '" : [' + stage_list[j].stage_name + ']';
        }
        context.done(null, { text: param.message });
    }
}

function postTrace(body, param, context) {
    //投稿された手順をチェック
    var words = param.event.text.split(param.event.trigger_word);
    words[1] = replaceAll(words[1], '　', ' ');
    words = words[1].trim().split(" ");
    var trace = words[2].trim();
    var user_name = param.event.user_name;
    if (words[3] !== undefined && words[3].trim() !== '') {
        user_name = words[3].trim();
    }

    //取得した面データと、移動手順を照合して正しいかチェック
    //正常時は、テーブルに追記
    //異常時はメッセージ出力して終了
    var records = body.records;
    var stage = records[0].stage.value; //必ず１件のみ帰ってくるので、0固定
    var check_trace_result = checkTrace(stage, trace);
    console.log('records[0] : ' + JSON.stringify(records[0]));

    if (check_trace_result[0]) {
        //レコード書き込み
        //利用履歴アプリにレコード追加
        var record = {
            "unique_name": { "value": records[0].unique_name.value },
            "minimum": { "value": trace.length },
            "trace": { "value": trace },
            "name": { "value": user_name },
            "slack_user_id": { "value": param.event.user_id },
            "memo": { "value": 'slackから自動投稿' },
            "unique_key": {
                "value": records[0].unique_name.value + '-' +
                    user_name + '-' + trace.length
            }
        };
        var options_insert = {
            method: 'POST',
            token: TRACE_APP_TOKEN,
            appid: TRACE_APP_ID,
            record: record
        };
        //レコードを追加
        request(makePOSTPUToptions(options_insert), function(error, response, body) {
            if (!error && response.statusCode === 200) {
                console.log('insert success response:', JSON.stringify(response, null, 2));
                console.log('insert success body:', JSON.stringify(body, null, 2));
                var message = '\nSUCCESS : Registered the trace data.';
                context.done(null, { text: message });
            } else {
                //デバッグコード
                console.log('insert error response:', JSON.stringify(response, null, 2));
                console.log('insert error error:', JSON.stringify(error, null, 2));
                var message = '';
                if (response.body.errors["record.unique_key.value"].messages[0] ===
                    '値がほかのレコードと重複しています。') {
                    message = '\nERROR : It is already the same steps is registered.';
                } else {
                    message = '\nERROR : record POST';
                }
                context.done(null, { text: message });
            }
        });
    } else {
        //移動データが面と不整合なので、エラー
        var message = check_trace_result[1] + '\n\nUsage : sokobot ' + USAGE_TRACE;
        message += makeTracedataInfo();
        context.done(null, { text: message });
    }
}

function checkTrace(stage, trace) {
    var stagedata = fixSquare(stage, '');
    stage = stagedata[0];
    var x_max = stagedata[1];
    var direction = {
        'u': -1 * stagedata[1],
        'r': 1,
        'd': stagedata[1],
        'l': -1,
        'U': -1 * stagedata[1],
        'R': 1,
        'D': stagedata[1],
        'L': -1
    };
    var map_convert = {};
    map_convert[map_space] = byte_space;
    map_convert[map_point] = byte_point;
    map_convert[map_box] = byte_box;
    map_convert[map_box_on_point] = byte_box_on_point;
    map_convert[map_rabi] = byte_space;
    map_convert[map_rabi_on_point] = byte_point;
    map_convert[map_block] = byte_block;
    map_convert[map_outside] = byte_space;

    //rabi抜きのデータに変換
    var rabi = stage.indexOf(map_rabi); //人の位置
    stage = stage.replace(map_rabi, map_space);
    if (rabi < 0) {
        rabi = stage.indexOf(map_rabi_on_point); //格納地点上の人の位置
        stage = stage.replace(map_rabi_on_point, map_point);
    }
    var stage_byte = [];
    for (var i = 0; i < stage.length; i++) {
        stage_byte.push(map_convert[stage.substring(i, i + 1)]);
    }
    //ここまで初期設定

    //    console.log('rabi : ' + rabi + 'stage : ' + stage_byte.join(''));
    for (var i = 0; i < trace.length; i++) {
        var move = trace.substring(i, i + 1);
        if (!(move in direction)) {
            return [false, makeTraceErrorMessage('Illegal code', x_max, rabi, stage_byte, trace, i)];
        }
        var pos = parseInt(rabi + direction[move]);
        if (move === 'U' || move === 'R' || move === 'D' || move === 'L') {
            if (pos > 0 && (stage_byte[pos] & byte_mask_box)) {
                var pos2 = parseInt(rabi + direction[move] * 2);
                if (stage_byte[pos2] & byte_mask_space) {
                    // boxが押せない
                    return [false, makeTraceErrorMessage("can't push box", x_max, rabi, stage_byte, trace, i)];
                } else {
                    //荷物を押して移動
                    stage_byte[pos] = stage_byte[pos] ^ byte_box;
                    stage_byte[pos2] = stage_byte[pos2] | byte_box;
                }
            } else {
                // boxが無い
                return [false, makeTraceErrorMessage('not box', x_max, rabi, stage_byte, trace, i)];
            }
            //            console.log('b move : ' + move + 'rabi : ' + rabi + ' / stage : ' + stage_byte.join(''));
        } else {
            if ((stage_byte[pos] & byte_mask_space) !== byte_space) {
                // 移動先に荷物か壁がある
                return [false, makeTraceErrorMessage('not space', x_max, rabi, stage_byte, trace, i)];
            }
            //            console.log('s move : ' + move + 'rabi : ' + rabi + ' / stage : ' + stage_byte.join(''));
        }
        rabi = pos;
    }
    if (stage_byte.indexOf(byte_box) < 0) {
        return [true, 'CLEAR'];
    } else {
        // 押し終わったが、クリアしていない
        return [false, makeTraceErrorMessage('not complete', x_max, rabi, stage_byte, trace, i)];
    }
}

function makeTraceErrorMessage(message, x_max, rabi, stage_byte, trace, i) {
    var stage = '';
    stage_byte[rabi] = stage_byte[rabi] | byte_rabi;
    for (var j = 0; j < stage_byte.length; j += x_max) {
        for (var k = 0; k < x_max; k++) {
            stage += stage_byte[j + k];
        }
        stage = replaceAll(stage, byte_space, map_space);
        stage = stage.trimRight() + '\n';
    }
    stage = fixSquare(stage, '\n')[0];
    stage = replaceAll(stage, '%', ':outside:');
    stage = replaceAll(stage, byte_block, ':wall:');
    stage = replaceAll(stage, byte_point, ':point:');
    stage = replaceAll(stage, map_space, ':floor:');
    stage = replaceAll(stage, byte_box, ':box:');
    stage = replaceAll(stage, byte_rabi, ':rabi:');
    stage = replaceAll(stage, byte_box_on_point, ':boxpoint:');
    stage = replaceAll(stage, byte_rabi_on_point, ':rabipoint:');

    var result_message = stage;
    result_message += '\nwrong trace code [' + message + ']: "' + trace.slice(i, i + 1) + '"';
    result_message += '\n' + trace.slice(0, i) + ' `[' + trace.slice(i, i + 1) + ']` ' + trace.slice(i + 1);
    console.log(result_message);
    console.log('rabi : ' + rabi + 'stage : ' + stage_byte.join(''));
    return result_message;
}

function checkMapdata(mapwords, param, context) {
    // mapwords.length は6以上確定
    var stage_name = mapwords[1];
    var creator = mapwords[2];
    var trace = mapwords[3];
    var stage = '';
    for (var i = 4; i < mapwords.length; i++) {
        if (mapwords[i] !== '') {
            stage += mapwords[i] + '\n';
        }
    }
    stage = stage.slice(0, stage.length - 1);
    var check_trace_result = checkTrace(stage, trace);

    if (check_trace_result[0]) {
        //レコード書き込み
        //投稿面アプリにレコード追加
        var record = {
            "serial_number": { "value": '' },
            "minimum": { "value": trace.length },
            "trace": { "value": trace },
            "name": { "value": creator },
            "slack_user_id": { "value": param.event.user_id },
            "stage": { "value": stage },
            "memo": { "value": 'slackから自動投稿' },
            "unique_key": { "value": '' }
        };
        var options_insert = {
            method: 'POST',
            token: CREATE_APP_TOKEN,
            appid: CREATE_APP_ID,
            record: record
        };
        //レコードを追加
        request(makePOSTPUToptions(options_insert), function(error, response, body) {
            if (!error && response.statusCode === 200) {
                console.log('insert success response:', JSON.stringify(response, null, 2));
                console.log('insert success body:', JSON.stringify(body, null, 2));
                var message = '\nSUCCESS : Registered the stage data.';
                context.done(null, { text: message });
            } else {
                //デバッグコード
                console.log('insert error response:', JSON.stringify(response, null, 2));
                console.log('insert error error:', JSON.stringify(error, null, 2));
                var message = '';
                if (response.body.errors["record.unique_key.value"].messages[0] ===
                    '値がほかのレコードと重複しています。') {
                    message = '\nERROR : It is already the same stage is registered.';
                } else {
                    message = '\nERROR : record POST';
                }
                context.done(null, { text: message });
            }
        });
    } else {
        //移動データが面と不整合なので、エラー
        var message = check_trace_result[1] + '\n\nUsage : sokobot  create /Name/Creator/Trace/s/t/a/g/e/d/a/t/a/';
        message += '\n       ex : create /sample/okiyasu/drU/ ##/# .#/#@$#/#  #/ ##/';
        message += makeMapdataInfo() + '\n' + makeTracedataInfo();
        context.done(null, { text: message });
    }
}

function showHistory(param, context, history_date) {
    var options_gethistory = {
        method: 'GET',
        token: HISTORY_APP_TOKEN,
        appid: HISTORY_APP_ID,
        query: '',
        fields: [
            '$id',
            'year',
            'month',
            'media',
            'title',
            'platform',
            'company'
        ]
    };
    options_gethistory.query += checkHistoryParam(history_date);
    console.log('callRequest history : ');
    callRequest(makeGEToptions(options_gethistory), param, context, makeHistoryInfo);
}

function checkHistoryParam(history_date) {
    //年月指定が間違っていたら、最新５件表示
    var query = ' order by year desc limit 5';
    if (history_date.length === 4 && history_date.match(/^[0-9/]+$/)) {
        //年のみ
        query = ' year = ' + history_date;
    } else {
        if (history_date.indexOf('-') >= 0) {
            query = ' year >= ' + history_date.split('-')[0];
            query += ' and year <= ' + history_date.split('-')[1];
        } else if (history_date.indexOf('/') >= 0) {
            query = ' year = ' + history_date.split('/')[0];
            query += ' and month = ' + history_date.split('/')[1];
        }
    }
    return query;
}

function makeHistoryInfo(body, param, context) {
    var records = body.records;
    if (records.length === 0) {
        context.done(null, { text: 'その時代には、何も見つからないね。。。' });
    }
    var history_list = [];
    //レコードから面データ取得
    for (var i = 0; i < records.length; i++) {
        var month = 0;
        if (records[i].month.value) {
            month = parseInt(records[i].month.value);
        }
        var history_data = {
            'year': parseInt(records[i].year.value),
            'month': month,
            'title': records[i].title.value,
            'platform': records[i].platform.value,
            'company': records[i].company.value
        };
        history_list.push(history_data);
    }
    console.log('history : ' + JSON.stringify(history_list));
    //日付（年月）の新しい順にソート
    history_list.sort(function(a, b) {
        if (a.year < b.year) return -1;
        if (a.year > b.year) return 1;
        if (a.month < b.month) return -1;
        if (a.month > b.month) return 1;
        return 0;
    });

    param.message = '\nその時代には、これらが発売されていますね。\n';
    for (var j = 0; j < history_list.length; j++) {
        param.message += '\n' + history_list[j].year + '年';
        if (history_list[j].month !== 0) {
            param.message += history_list[j].month + '月';
        }
        param.message += 'に、' + history_list[j].title + 'が' + history_list[j].platform;
        param.message += 'で、' + history_list[j].company + 'から発売';
    }
    context.done(null, { text: param.message });
}

function callRequest(options, param, context, callback) {
    console.log('options:', JSON.stringify(options, null, 2));
    console.log('param:', JSON.stringify(param, null, 2));
    request(options, function(error, response, body) {
        //デバッグコード
        console.log('response:', JSON.stringify(response, null, 2));
        console.log('error:', JSON.stringify(error, null, 2));
        console.log('body:', JSON.stringify(body, null, 2));
        if (!error && response.statusCode == 200) {
            callback(body, param, context);
        } else {
            //エラー時にどうするかは未定
        }
    });
}

function checkStageParam(words, triggerWord) {
    var query = '';
    if (words.length >= 2) {
        query += ' and unique_name="' + words[1].trim() + '"';
    } else {
        // 面指定がないときはランダム。
        // ただ、今は全取得後にランダム指定なので、無断なデータの受信がある。
        // 最初にレコードIDのみ取得で、ランダム選択後にレコードID指定で再取得だと、
        // データ受信が減りリクエスト回数と処理時間が増える。
        // トレードオフなので、登録面が増えたら要検討。
    }
    //    query += ' order by 更新日時 desc limit 5';
    return query;
}

exports.handler = (event, context, callback) => {
    console.log('event:' + JSON.stringify(event));
    console.log('context:' + JSON.stringify(context));

    console.log('start : ');
    var triggerWord = event.trigger_word;
    var words = event.text.split(triggerWord);
    words = words[1].trim().split(" ");
    var param = {
        'message': '',
        'event': event
    };
    var options_getstage = {
        method: 'GET',
        token: STAGE_APP_TOKEN,
        appid: STAGE_APP_ID,
        query: 'slack in ("公開") ',
        fields: [
            '$id',
            'unique_name',
            'set_no',
            'set_name',
            'set_name_eng',
            'stage_no',
            'stage_name'
        ]
    };
    if (words.length > 0) {
        if (words[0] === "stage") {
            options_getstage.fields.push('creator');
            options_getstage.fields.push('stage');
            options_getstage.query += checkStageParam(words, triggerWord);
            console.log('callRequest stage : ');
            callRequest(makeGEToptions(options_getstage), param, context, getStage);
        } else if (words[0] === "solved") {
            options_getstage.fields.push('record');
            options_getstage.fields.push('record_holder');
            options_getstage.fields.push('Table');
            options_getstage.query += checkStageParam(words, triggerWord);
            console.log('callRequest solved : ');
            callRequest(makeGEToptions(options_getstage), param, context, getSolved);
        } else if (words[0] === "trace") {
            //            console.log('words : ' + words + ' / length : ' + words.length);
            options_getstage.fields.push('record');
            options_getstage.fields.push('record_holder');
            options_getstage.fields.push('stage');
            options_getstage.fields.push('Table');
            if (words.length >= 3) {
                options_getstage.query += checkStageParam(words, triggerWord);
                console.log('callRequest trace : ');
                callRequest(makeGEToptions(options_getstage), param, context, postTrace);
            } else {
                // 解答手順申告なのに、面と手順が揃ってなかったらエラー終了
                var message = '\nERROR:Illegal format. \nUsage : ' + triggerWord + ' ' + USAGE_TRACE;
                callback(null, { "text": message });
            }
        } else if (words[0] === "stagelist") {
            var listwords = event.text.split(triggerWord);
            listwords = listwords[1].trim().split(words[0]);
            if (listwords.length >= 2 && listwords[1].trim() !== '') {
                options_getstage.query += ' and set_name_eng="' + listwords[1].trim() + '"';
                console.log('callRequest stagelist : ');
                callRequest(makeGEToptions(options_getstage), param, context, showStagelist);
            } else {
                // セット名（英字）指定がなかったら、セット名一覧を表示して終了
                makeNothingMessage(context, "");
                //                var message = '\nERROR:Illegal format. \nUsage : ' + triggerWord + ' stagelist set_name';
                //                callback(null, { "text": message });
            }
        } else if (words[0] === "create") {
            var mapwords = event.text.split(triggerWord);
            mapwords = mapwords[1].trim().split(words[0]);
            mapwords = mapwords[1].trim().split('/');
            console.log('mapwords : ' + mapwords);
            if (mapwords.length >= 6) {
                checkMapdata(mapwords, param, context);
            } else {
                // セット名（英字）指定がなかったらエラー終了
                var message = '\nERROR:Illegal format. \nUsage : ' + triggerWord + ' create /Name/Creator/Trace/s/t/a/g/e/d/a/t/a/';
                message += '\n       ex : create /sample/okiyasu/drU/ ##/# .#/#@$#/#  #/ ##/';
                message += makeMapdataInfo() + '\n' + makeTracedataInfo();
                callback(null, { "text": message });
            }
        } else if (words[0] === "product") {
            // 製品情報表示
            var message = '\nProduct List' +
                '\n    <http://sokoban.jp/products/firststepplus/|sokoban firststepplus for Windows>' +
                '\n    <http://sokoban.jp/products/perfectplus/|sokoban perfectplus A & B for Windows>' +
                '\n    <http://sokoban.jp/products/revenge/|sokoban revenge for Windows>' +
                '\n    <https://itunes.apple.com/jp/app/sokoban-touch/id1123927982?l=ja&ls=1&mt=8|sokoban Touch for iOS>' +
                '\n    <https://play.google.com/store/apps/details?id=jp.thinkingrabbit.sokobantouch_free&utm_source=global_co&utm_medium=prtnr&utm_content=Mar2515&utm_campaign=PartBadge&pcampaignid=MKT-AC-global-none-all-co-pr-py-PartBadges-Oct1515-1|sokoban Touch for Andoroid>';
            callback(null, { "text": message });
        } else if (words[0] === "copyright") {
            var message = '\n「倉庫番」および「sokoban」、兎マーク、「シンキングラビット」、「THINKING RABBIT」は、ファルコン株式会社の登録商標または商標です。' +
                '\n"倉庫番", "sokoban", the rabbit mark and "THINKING RABBIT" are trademarks or registered trademarks of Falcon co.,ltd. in Japan and other countries.' +
                '\n「倉庫番」は著作物であり、今林宏行とファルコン株式会社によって、全ての権利が留保されています。' +
                '\nCOPYRIGHT(c)1982-2016 HIROYUKI IMABAYASHI' +
                '\nCOPYRIGHT(c)1989,1990,2001-2016 FALCON CO.,LTD. ALL RIGHTS RESERVED.';
            callback(null, { "text": message });
        } else if (words[0] === "type") {
            var stage = event.text.split(triggerWord);
            stage = stage[1].trim().split(words[0]);
            stage = replaceCode(stage[1].slice(1));
            callback(null, { "text": replaceAll(stage, '/', '\n') });
        } else {
            console.log('non-macching word : "' + words[0] + '"');
            if (words[0] !== '') {
                param.message = '\n"' + words[0] + '" ...?\n';
            } else {
                param.message = '';
            }
            if (words[0] !== '' && words[0].match(/^[0-9\-\/]+$/) && words[0].length < 10) {
                //歴史表示。 1982 or 1982/1 or 1999-2003 のみ受付
                showHistory(param, context, words[0]);
            } else {
                //使い方説明
                param.message += '\nUsage :\n    ' + triggerWord + ' stage <StageID>' +
                    '\n    ' + triggerWord + ' solved <StageID>' +
                    '\n    ' + triggerWord + USAGE_TRACE +
                    '\n    ' + triggerWord + ' stagelist SetName' +
                    '\n    ' + triggerWord + ' product' +
                    '\n    ' + triggerWord + ' create /Name/Creator/Trace/s/t/a/g/e/d/a/t/a/' +
                    '\n    ' + triggerWord + ' copyright';
                callback(null, { "text": param.message });
            }
        }
    } else {
        console.log('callback : ');
        callback(null, { "text": 'hmmmmmm?' });
    }
};
