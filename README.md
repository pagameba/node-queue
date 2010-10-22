Getting Started
===============

Welcome to **node-queue**, a simple, high-performance message queueing system for node.js.  The design goal is to provide a flexible put/get/delete queue system that minimizes the overhead of the queueing system itself and gets the messages from a *publisher* to a *consumer* with as little fuss as possible.

Below this section, you will find an Overview section that provides an overview of how the queueing system works in general and an Operations system that provides specific details on each operation that can be performed against a queue.

Have fun!

Prerequisites
-------------

You'll need the following

* node 
* libuuid headers in uuid/uuid.h are required (libuuid-devel) to build uuidjs

Getting the code
----------------

    git clone git://github.com/pagameba/node-queue.git
    cd node-queue
    git submodule update --init
    cd deps/node-microseconds
    node-waf configure build test
    cd ../uuidjs
    node-waf configure build

Configuration
-------------

Copy config.json.sample to config.json.  Edit as required.  Configurable values are:

* web.port - the port to run the http server on, default is 8080
* queue.maxconnections - the maximum number of connected consumers waiting for messages
* queue.locktimout - the number of seconds a locked message will be left until it is automatically unlocked
* queue.defaultpriority - the default priority for new messages
* queue.maxlockcount - the maximum number of times a message should be locked before it is considered dead

Running **node-queue**
----------------------

    node node-queue.js

To Do:
------

* investigate methods for distributing the system across multiple servers to remove single point of failure
* investigate methods of persisting queues and messages to preserve data integrity in the event of server crash
* write some tests
* build a web interface hopefully using websockets that allows an administrator to monitor the system

Using **node-queue**
====================

The queueing system is built as a web service and provides a RESTful interface as well as one built on GET requests with parameters.  Either interface can be used for any operation, and the use of them can be mixed.

In **node-queue**, a *publisher* pushes a message onto a named queue for processing by a *consumer*.  Queue names have no particular meaning to the service, they are usually established as a convention between the publisher and subscriber.  For convenience, queues are created implicitly as required.  The consumer requests messages from a named queue, typically blocking if no message is immediately available for processing.  The interface provides several options, please see the specific documentation below for available options and their effect on each operation.  Once a consumer has received a message, the message is locked for some period of time allowing the consumer to handle the message.  The consumer is responsible for deleting the message from the queue once it has dealt with it.  Locked messages that are not deleted are returned to the queue to allow another consumer to attempt to process it.  Messages that are locked and released multiple times end up in a special dead letter queue for later manual analysis.

Messages
--------

The concept of a message is rather arbitrary in that the system itself just treats the message as a single entity.  It was developed primarily to pass JSON-encoded objects from a web client to a server process but it should work for any content at all.  I'm not sure how binary data is handled in node but it might also work with binary data out of the box or with minimal modifications.

Messages may have priority, allowing higher priority messages to be distributed before lower priority messages.  There are three priority levels - 1, 2 and 3 - in decreasing order of priority.  By default, messages are added with medium priority.  A new priority may be specified when adding a message.

Putting Messages In The Queue
-----------------------------

A message is published to the system by invoking the publish operation of a queue.  The message is logged into the queue and gets some metadata added to it.

Getting Messages From The Queue
-------------------------------

A message is consumed by a process requesting the next available message from the queue or by requesting a message by its id specifically.  When a message is consumed, it is returned directly to the calling process but it is not removed from the queue, rather it is locked and a lock value is returned with the message.  The consumer is responsible for deleting the message using the lock value and message id when the consumer has finished processing the message.

Locked Messages
---------------

If the consumer takes longer than the lock timeout period, the message is released back into the queue for processing by another consumer.  The intention is that consumers that fail to process a message do not consume the message by default, giving another consumer a chance to handle the message.

The lock timeout period is specified in the configuration of the server, and can be configured per-queue using the set operation (see below).

A locked message will not be returned when a consumer requests the next available message.  A locked message will be visible in the results of the list operation but will be noted as locked.  A locked message may be returned to a consumer when requested directly using the message id with the lock option turned off.  The intention here is that a consumer can inspect a locked message even though they should not take action on it.

Caveats:
--------

The system is not designed for distribution across multiple servers which means that it is a single point of failure (as written).  

The system is not designed to persist messages in the queue in the event of a catastrophic failure.  This means if the server dies for some reason, any messages in any queue in the system will be lost and not available when the server is restarted.

Operations
==========

Unless otherwise specified, all return values are JSON-formatted objects.  The examples use a fictional URL to a queueing server running **node-queue**, http://queue.server.com/.  This fictional server is running three queues for a typical development stack containing development, staging and production environments.

Listing Queues
--------------

Lists all queues currently in the system.

    GET /queues

Returns status code 200 and a JSON-encoded array of queue names that are currently running.

Example:

    GET http://queue.server.com/queues

    ['development','staging','production']

Listing Messages
----------------

Lists messages in a named queue.

    GET /queue/<queue-name>/list

Returns status code 200 and lists messages in the specified queue as the content

Example:

    GET http://queue.server.com/queue/development/list

Getting Information About a Queue
---------------------------------

Get statistics about a named queue, including number of messages, consumers, and requests served.

    GET /queue/<queue-name>/stats

Returns status code 200 and the queue stats as the content

Example:

    GET /queue/development/stats

    {
        "queues": {
            "1": [],
            "2": [{
                "id":"test-A6877FC8-ECC7-40C8-8FEA-F20590DA80C4",
                "message":"Hello World",
                "priority":2,
                "lock":null,
                "added":1287753785865.934,
                "locked":null,
                "lockCount":3
              }],
            "3": []},
        "locked": [],
        "deadLetters": []
    }


configuration
-------------

Manage the configuration of a named queue.  Configuration parameters for a queue are:

* locktimeout - the amount of time in milliseconds that a message will be locked for after it has been requested from a queue.  After the timeout expires, the message will be made generally available on the queue again.  See the configuration section above for the default value.

* maxconnections - the maximum number of consumers that can be waiting, blocked, for messages coming from a specific queue.  When the maximum number of consumers are waiting, blocked, then new consumers attempting to subscribe to the queue will respond with a 503 status code.  See the configuration section above for the default value.

* defaultpriority - the default priority for messages added to the queue without a priority.  See the configuration section above for the default value.

* maxlockcount - the maximum number of times a message can be locked and released before it is considered dead.  See the configuration section above for the default value.

A queue's configuration takes on the default configuration specified in the server configuration file when the queue is created (the first time the queue is named in any request).

    GET /queue/<queue-name>/configuration

Returns status code 200 and the queue configuration information as the content

    GET /queue/<queue-name>/configuration?<parameter>=<value>

Returns status code 200 with the new configuration information as the content

    PUT /queue/<queue-name>

Parses the request body as JSON and sets configuration parameters for the queue.

Examples:

    TDB

consume
-------

Retrieve a message from a named queue.

    GET /queue/<queue-name>?[block=false]&[lock=false]

**block=false** - optional, do not block if no message is available.  By default, the call will block until a message is available.

**lock=false** - optional, do not lock the returned message.  The message will be locked unless otherwise specified.  A locked message will not be returned by subsequent calls to request messages nor will it be available by <id> unless the lock parameter is set to false.

Returns status code 200 with the next available message from the queue as the content.  The returned message will include a lock to be used with a delete operation.  Only the consumer that has locked the message should be able to delete it while it is locked.

Returns status code 204 if the request is non-blocking

Returns status code 503 if the request would have blocked and the maximum number of consumers are already blocked (see configuration above).

    GET /queue/<queue-name>/<messageid>?[lock=false]

**lock=false** - optional, do not lock the returned message.  The message will be locked unless otherwise specified.  A locked message will not be returned by subsequent calls to request messages nor will it be available by <id> unless the lock parameter is set to false.

Requesting a message by id will never block if the message is unavailable.

Returns status code 200 with the specific message requested by the messageid as the content.  This call does not block.

Returns status code 404 if a message with the specified messageid is not found in the queue or if the specified message is locked and lock=false is not specified.

Example:

    TDB

publish
-------

Publish a message on the named queue.

    GET /queue/<queue-name>/publish?message=<message>[&priority=<priority>]
    
**message=<message>** - the message to insert.  Designed to carry a JSON payload, any text-encoded value should work very well.  Binary content may work out of the box or it may require some modifications.
    
**priority=<priority>** - optional priority for the message, must be one of 1, 2 or 3.

Returns status code 200 with the newly inserted message id as the content if the message was dispatched to a consumer immediately and status code 202 if the message was queued.

    POST /queue/<queue-name>[?priority=<priority]

**priority=<priority>** - optional priority for the message, must be one of 1, 2 or 3.

Uses the request body as the message content.  You may use POST and provide a message argument in the GET parameters, however the POST content will be used if it is not empty.  Returns status code 200 with the newly inserted message's id as the content if the message was dispatched to a consumer immediately and status code 202 if the message was queued.

Example:

   TDB

flush
-----

Flushes all messages from a named queue, preserving queue statistics.

    GET /queue/<queue-name>/flush

Returns status code 200.

    DELETE /queue/<queue-name>

Returns status code 200.

Example:

    TDB

delete
------

Delete a specific message from a named queue.

    GET /queue/<queue-name>/delete?id=<message-id>[&lock=<message-lock>]
    
**id=<message-id>** - the id of the message to delete
**lock=<message-lock>** - optional, the lock value provided when the message was locked.  If the message is not locked, any consumer can delete it.  If the message is locked, it can only be deleted by providing the lock value returned with the message when it was received from the queue.

Returns status code 200 if the specified message was found in the queue and removed.

Returns status code 404 if the specific message was not found in the queue.

Returns status code 403 if the specified message was locked and the deletekey was not specified or it was specified but was incorrect.

Example:

    TDB

clear dead letters
------------------

    GET /queue/<queue-name>/cleardeadletters

Returns status code 200 and clears the dead letters from the named queue.