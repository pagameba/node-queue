Overview
========

node-queue is a simple, high-performance message queueing system for node.js.  The design goal is to provide a flexible publish/subscribe queue system that minimizes the overhead of the queueing system itself and gets the messages from the publisher to the subscriber with as little fuss as possible.

The queueing system is built as a web service and provides a RESTful interface as well as one built on GET requests with parameters.  Either interface can be used for any operation, and the use of them can be mixed.

In node-queue, a publisher pushes a message onto a named queue for processing by a consumer.  Queue names have no particular meaning to the service, they are usually established as a convention between the publisher and subscriber.  For convenience, queues are created implicitly as required.  A consumer requests messages from a named queue, typically blocking if no message is immediately available for processing.  The interface provides several options, please see the specific documentation below for available options and their effect on each operation.

A Note About Message Locking
----------------------------

When a consumer requests a message from a named queue, the message becomes locked for some period of time.  This allows a consumer time to process a message and subsequently delete it from the queue so that it is permanently unavailable.  If the consumer takes longer than the lock timeout period, the message is released back into the queue for processing by another consumer.  The intention is that consumers that fail to process a message do not consume the message by default.

The lock timeout period is specified in the configuration of the server, and can be configured per-queue using the set operation (see below).

A locked message will not be returned when a consumer requests the next available message.  A locked message will be visible in the results of the list operation but will be noted as locked.  A locked message may be returned to a consumer when requested directly using the message id with the lock option turned off.  The intention here is that a consumer can inspect a locked message even though they should not take action on it.

Caveats:
--------

The system is not designed for distribution across multiple servers which means that it is a single point of failure (as written).  

The system is not designed to persist messages in the queue in the event of a catastrophic failure.  This means if the server dies for some reason, any messages in any queue in the system will be lost and not available when the server is restarted.

To Do:
------

* investigate methods for distributing the system across multiple servers
* investigate methods of persisting queues and messages to preserve data integrity in the event of server crash
* tests

Operations
==========

Unless otherwise specified, all return values are JSON-formatted objects.

list
----

Lists messages in a named queue.

    GET /<queue>/list

Returns status code 200 and lists messages in the specified queue as the content

Example:

stats
-----

Get statistics about a named queue, including number of messages, consumers, and requests served.

    GET /<queue>/stats

Returns status code 200 and the queue stats as the content

Example:

configuration
-------------

Manage the configuration of a named queue.  Configuration parameters for a queue are:

* locktimeout - the amount of time in milliseconds that a message will be locked for after it has been requested from a queue.  After the timeout expires, the message will be made generally available on the queue again.

* maxconnections - the maximum number of consumers that can be waiting, blocked, for messages coming from a specific queue.  When the maximum number of consumers are waiting, blocked, then new consumers attempting to subscribe to the queue will respond with a 503 status code.

    GET /<queue>/configuration

Returns status code 200 and the queue configuration information as the content

Example:

    GET /<queue>/configuration?<parameter>=<value>

Returns status code 200 with the new configuration information as the content

Example:

    PUT /<queue>

Parses the request body as JSON and sets configuration parameters for the queue.

Example:

consume
-------

Retrieve a message from a named queue.

    GET /<queue>?[blocking=false]&[lock=false]

Returns status code 200 with the next available message from the queue as the content.  The returned message will include a deletekey to be used with a delete operation.  Only the consumer that has locked the message is able to delete it while it is locked.

Returns status code 503 if the request would have blocked and the maximum number of consumers are already blocked (see configuration above).

* blocking=false - optional, do not block if no message is available.  By default, the call will block until a message is available.

* lock=false - optional, do not lock the returned message.  The message will be locked unless otherwise specified.  A locked message will not be returned by subsequent calls to request messages nor will it be available by <id> unless the lock parameter is set to false.

    GET /<queue>/<messageid>?[lock=false]

Returns status code 200 with the specific message requested by the messageid as the content.  This call does not block.

Returns status code 404 if a message with the specified messageid is not found in the queue or if the specified message is locked and lock=false is not specified.

Example:

publish
-------

Publish a message on the named queue.

    GET /<queue>/push?message=<message>

Returns status code 200 with the newly inserted message id as the content

    POST /<queue>

Uses the request body as the message content.  Returns status code 200 with the newly inserted message's id as the content.

Example:

flush
-----

Flushes all messages from a named queue, preserving queue statistics.

    GET /<queue>/flush

Returns status code 200.

    DELETE /<queue>

Returns status code 200.

delete
------

Delete a specific message from a named queue.

    GET /<queue>/delete?id=<messageid>[&deletedkey=<deletekey>]

Returns status code 200 if the specified message was found in the queue and removed.

Returns status code 404 if the specific message was not found in the queue.

Returns status code 403 if the specified message was locked and the deletekey was not specified or it was specified but was incorrect.

Getting node-queue
==================

    git clone git://github.com/pagameba/node-queue.git
    cd node-queue
    git submodule update --init
    cd deps/node-mongodb-native
    make
    cd ../node-microseconds
    node-waf configure build test

