import 'package:socket_io_client/socket_io_client.dart' as io;
import 'dart:convert';
import 'auth_service.dart';

class SocketService {
  static io.Socket? _socket;
  static Function(Map)? onP2pMessage;
  static Function(Map)? onGroupMessage;
  static Function(Map)? onCallReceived;
  static Function()? onCallAnswered;
  static Function(Map)? onNewGroup;

  static void connect() {
    if (_socket != null) return;
    _socket = io.io(socketUrl, {
      'transports': ['websocket'],
      'autoConnect': true,
    });

    _socket!.onConnect((_) {
      print('Socket connected');
      _socket?.emit('login', AuthService.uid);
    });

    _socket?.on('recv_p2p_msg', (data) {
      if (onP2pMessage != null) {
        onP2pMessage!(Map<String, dynamic>.from(data));
      }
    });

    _socket?.on('recv_group_msg', (data) {
      if (onGroupMessage != null) {
        onGroupMessage!(Map<String, dynamic>.from(data));
      }
    });

    _socket?.on('recv_call', (data) {
      if (onCallReceived != null) {
        onCallReceived!(Map<String, dynamic>.from(data));
      }
    });

    _socket?.on('call_answered', (data) {
      if (onCallAnswered != null) onCallAnswered!();
    });

    _socket?.on('new_group', (data) {
      if (onNewGroup != null) {
        onNewGroup!(Map<String, dynamic>.from(data));
      }
    });
  }

  static void sendP2pMessage(int toUid, String content, {String type = 'text'}) {
    _socket?.emit('send_p2p_msg', {
      'toUid': toUid,
      'content': content,
      'type': type,
    });
  }

  static void sendGroupMessage(String groupId, String content, {String type = 'text'}) {
    _socket?.emit('send_group_msg', {
      'groupId': groupId,
      'content': content,
      'type': type,
    });
  }

  static void createGroup(String groupName, List<int> memberUids) {
    _socket?.emit('create_group', {
      'groupName': groupName,
      'memberUids': memberUids,
    });
  }

  static void joinGroup(String groupId) {
    _socket?.emit('join_group', groupId);
  }

  static void callUser(int toUid, String callType, Map<String, dynamic> offer) {
    _socket?.emit('call_user', {
      'toUid': toUid,
      'callType': callType,
      'offer': offer,
    });
  }

  static void answerCall(int toUid, bool answer) {
    _socket?.emit('answer_call', {
      'toUid': toUid,
      'answer': answer,
    });
  }

  static void sendIceCandidate(int toUid, Map<String, dynamic> candidate) {
    _socket?.emit('ice_candidate', {
      'toUid': toUid,
      'candidate': candidate,
    });
  }

  static void hangUp(int toUid) {
    _socket?.emit('hang_up', {'toUid': toUid});
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}