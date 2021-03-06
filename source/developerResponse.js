/**
 * Created by robert_Account on 2016-06-04.
 */
var fs = require('fs');
var slackbot = require('node-slackbot');
var token = require('../token/token.js');
var request = require('request');
var ticket = require('./TicketDatabase');
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport('direct:?name=slackos.teambana.com');
var BOT_HASH = '<@U1E5ZKB7S>';
var bot = new slackbot(token.BOT);
var userResponse = require('./userResponse.js');
var URGENT_CHANNEL = 'C1E74EV6G';

var setStatus = function (channelId, status) {

    request('https://slack.com/api/channels.info?token=' + token.WEB_HOOK + '&channel=' + channelId, function(error, response, body) {
        if (error || response.statusCode !== 200) {
            //API Error
        }
        

        var body_object = JSON.parse(body);
        if (body_object.ok) {
            var ticketId = body_object.channel.name;

            ticket.setStatus(ticketId, status);
        }

    });

};

bot.use(function (message, cb) {
    try {
        if (message != undefined && message != null && (message.type == 'message') && (message.text.includes(BOT_HASH))) {

            if (message.text.includes('CLOSE TICKET')) {
                var channel = message.channel;

                request('https://slack.com/api/channels.archive?token=' + token.WEB_HOOK + '&channel=' + channel, function (error, response, body) {
                    if (error || response.statusCode !== 200) {
                        //API Error
                    }

                    else {
                        //var senderName = body.user.real_name;

                        var body_object = JSON.parse(body);

                        if (body_object.ok) {

                            //Set Status of ticket to 1

                            setStatus(channel, 1);

                        }

                    }
                });
            }

            else if (message.text.includes('MAKE URGENT')) {
                var channel = message.channel;

                request('https://slack.com/api/channels.info?token=' + token.WEB_HOOK + '&channel=' + channel,
                    function (error, response, body) {
                        if (error || response.statusCode !== 200) {
                            //API Error
                        }
                        else {

                            var body_object = JSON.parse(body);
                            if (body_object.ok) {
                                var ticketTitle = 'URGENT: ' + body_object.channel.topic.value;
                                var ticketId = body_object.channel.name;
                                ticket.getStatus(ticketId, function (statusCode) {
                                    //Check the see if it's already set to urgent
                                    if (statusCode == 2) return;

                                    ticket.setStatus(ticketId, 2);

                                    request('https://slack.com/api/channels.setTopic?token=' + token.WEB_HOOK + '&channel=' + channel + '&topic=' + ticketTitle,
                                        function (error2, response2, body2) {
                                            var body2_object = JSON.parse(body2);
                                            if (error2) {
                                                console.error(error2.message);
                                            } else if (!body2_object.ok)
                                                console.error(body2.error);
                                            else {

                                                request('https://slack.com/api/users.info?token=' + token.WEB_HOOK + '&user=' + message.user, function (error3, response3, body3) {

                                                    var body3_object = JSON.parse(body3);

                                                    if (body3_object.ok) {
                                                        var msg = 'ticket #' + ticketId.toString() + ' has been marked as URGENT by ' +
                                                            body3_object.user.profile.first_name + " " + body3_object.user.profile.last_name;
                                                        userResponse.sendMessageAsBot(msg, 'tickets-urgent', false);

                                                    }

                                                });

                                            }

                                        });

                                });
                            }
                        }
                    });
            }

            else if (message.text.includes('ADD CUSTOM FIELD')) {
                var index = message.text.indexOf('ADD CUSTOM FIELD');
                if (index > 0)
                    var message = message.text.substr(index);
                message = message.replace('ADD CUSTOM FIELD', '').trim();
                index = message.indexOf(' ');
                var field_name = message.substr(0, index);
                message = message.substr(index).trim();
                var field_desc = message.trim();
                console.log("Implements adding of field " + field_name + " DESCRIPTION: " + field_desc);
                ticket.insertCustomField(field_name, field_desc);
            }

            else if (message.text.includes('REMOVE CUSTOM FIELD')) {
                var index = message.text.indexOf('REMOVE CUSTOM FIELD');
                if (index > 0)
                    var message = message.text.substr(index);
                message = message.replace('REMOVE CUSTOM FIELD', '').trim();
                var words = message.split(' ');
                var fieldName = words[0];
                ticket.deleteCustomField(fieldName);
            }

            else if (message.text.includes('LIST CUSTOM FIELDS')) {
                ticket.getCustomFields(function (fields) {
                        var annotated = "Custom Fields";

                        for (var i = 0; i < fields.length; ++i) {
                            var field = fields[i];
                            var field_name = field.input_name;
                            var field_desc = field.input_desc;
                            annotated += "\nFieldName: " + field_name + "    Description: " + field_desc;
                        }

                        request('https://slack.com/api/channels.info?token=' + token.WEB_HOOK + '&channel=' + message.channel,
                            function (error, response, body) {
                                if (error || response.statusCode !== 200) {
                                    //API Error
                                }
                                else {

                                    var body_obj = JSON.parse(body);
                                    if (body_obj.ok) {
                                        var ticketId = body_obj.channel.name;

                                        userResponse.sendMessageAsBot(annotated, ticketId, false);
                                    }

                                }
                            });
                    },
                    function (error) {

                    });
            }
            else if (message.text.includes('WHO')) {
                request('https://slack.com/api/channels.info?token=' + token.WEB_HOOK + '&channel=' + message.channel,
                    function (error, response, body) {
                        if (error || response.statusCode !== 200) {
                            //API Error
                        }
                        else {

                            var body_object = JSON.parse(body);
                            if (body_object.ok) {
                                var ticketTitle = 'URGENT: ' + body_object.channel.topic.value;
                                var ticketId = body_object.channel.name;

                                ticket.fetchTicketRecord(ticketId, function (ticketData) {

                                    var annotated = "WHO?\n\n";
                                    annotated += "Name: " + ticketData.name;
                                    annotated += "\nEmail: " + ticketData.email;

                                    for (var key in ticketData.customFields) {
                                        if (ticketData.customFields.hasOwnProperty(key)) {
                                            annotated += "\n" + key + ": " + JSON.stringify(ticketData.customFields[key]);
                                        }
                                    }

                                    userResponse.sendMessageAsBot(annotated, ticketId, false);

                                }, function (err) {
                                    userResponse.sendMessageAsBot(JSON.stringify(err), ticketId, false);
                                });

                            }
                        }
                    });
            }

            else if (message.text.includes('HELP') || message.text.includes('LIST COMMANDS')) {

                var commands = "AVAILABLE COMMANDS\n\nCLOSE TICKET";
                commands += "\nMAKE URGENT";
                commands += "\nADD CUSTOM FIELD [fieldname] [description]";
                commands += "\nREMOVE CUSTOM FIELD [fieldname]";
                commands += "\nLIST CUSTOM FIELDS";
                commands += "\nWHO";

                request('https://slack.com/api/channels.info?token=' + token.WEB_HOOK + '&channel=' + message.channel,
                    function (error, response, body) {
                        if (error || response.statusCode !== 200) {
                            //API Error
                        }
                        else {

                            var body_object = JSON.parse(body);
                            if (body_object.ok) {
                                var ticketTitle = 'URGENT: ' + body_object.channel.topic.value;
                                var ticketId = body_object.channel.name;

                                userResponse.sendMessageAsBot(commands, ticketId, false);

                            }
                        }
                    });
            }

            else
                request('https://slack.com/api/users.info?token=' + token.WEB_HOOK + '&user=' + message.user, function (error, response, body) {
                    if (error) {
                    } else if (response.statusCode !== 200) {
                    }
                    else {
                        var senderName = JSON.parse(body).user.real_name;
                        request('https://slack.com/api/channels.info?token=' + token.WEB_HOOK + '&channel=' + message.channel, function (error, response, body) {
                            if (error) {
                            } else if (response.statusCode !== 200) {
                            }
                            else {
                                var channel = JSON.parse(body).channel.name;
                                sendEmail(channel, senderName, message.text, channel);
                            }
                        });
                    }
                });
        }
        cb();
    }
    catch(ex) {}
});

bot.connect();

var sendEmail = function (ticketID, respondingUserName, message, channel) {
    fs.readFile('./views/email.html', 'utf8', function (err, data) {
        if (err) {
            console.log(err);
        } else {
            var html = data;
            getTicket(ticketID, function (ticketData) {
                ticket.getTicketToken(ticketID, function(token) {
                    message = message.replace(BOT_HASH, ticketData.name);

                    ticket.insertTicketMessage(message, respondingUserName, channel);

                    console.log(message);

                    var text = "You have received a new response from " + respondingUserName + '\n' +
                        '"' + message + "\"\n" +
                        "To reply to your ticket, please copy and paste this link into your browser \n\n" +
                        "<LINK>";//TODO: Add link to response form

                    html = html.replace(/{{NAME}}/g, ticketData.name);
                    html = html.replace(/{{LINK}}/g, 'http://localhost:3000/response?id='+ticketID+'&token='+token);
                    html = html.replace(/{{MESSAGE}}/g, message);
                    html = html.replace(/{{SENDING_USER}}/g, respondingUserName);
                    html = html.replace(/{{TITLE}}/g, ticketData.title);


                    var mailOptions = {
                        from: '"Alfred@El Slackos" <alfred@elslackos.slack.com>', // sender address
                        to: ticketData.email, // list of receivers
                        subject: 'New reply to your ticket: ' + ticketData.title, // Subject line
                        text: text, // plaintext body
                        html: html // html body
                    };

                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            return console.log(error);
                        }
                        console.log('Message sent: ' + info.response);
                    });
                },
                function (err) {
                    //error handler
                });
            });
        }
    });
};

var getTicket = function (ticketID, cbNext, cbError) {
    ticket.fetchTicketRecord(ticketID, function (thisTicket) {
        cbNext(thisTicket);
    }, function (err) {
        if (cbError != null)
            cbError(err);
    });
};


