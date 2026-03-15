import 'package:dio/dio.dart';
import 'auth_service.dart';

class ApiService {
  static final Dio _dio = Dio(BaseOptions(
    baseUrl: apiUrl,
    connectTimeout: const Duration(seconds: 10),
    headers: AuthService.headers,
  ));

  static void updateHeaders() {
    _dio.options.headers = AuthService.headers;
  }

  // ==================== 用户相关 ====================
  static Future<List<dynamic>> searchUsers(String keyword) async {
    final res = await _dio.get('/api/user/search', queryParameters: {'keyword': keyword});
    return res.data['data'] ?? [];
  }

  static Future<Map?> getUserInfo(int uid) async {
    final res = await _dio.get('/api/user/info');
    return res.data['data'];
  }

  static Future<bool> updateUserInfo(Map<String, dynamic> data) async {
    final res = await _dio.post('/api/user/update', data: data);
    return res.data['code'] == 200;
  }

  static Future<bool> followUser(int uid) async {
    final res = await _dio.post('/api/user/follow', data: {'followUid': uid});
    return res.data['code'] == 200;
  }

  static Future<bool> unfollowUser(int uid) async {
    final res = await _dio.post('/api/user/unfollow', data: {'followUid': uid});
    return res.data['code'] == 200;
  }

  static Future<List<dynamic>> getFollows() async {
    final res = await _dio.get('/api/user/follows');
    return res.data['data'] ?? [];
  }

  static Future<List<dynamic>> getFollowers() async {
    final res = await _dio.get('/api/user/followers');
    return res.data['data'] ?? [];
  }

  static Future<List<dynamic>> getNearbyUsers() async {
    final res = await _dio.get('/api/user/nearby');
    return res.data['data'] ?? [];
  }

  static Future<bool> updateLocation(double lat, double lng) async {
    final res = await _dio.post('/api/user/update-location', data: {'lat': lat, 'lng': lng});
    return res.data['code'] == 200;
  }

  // ==================== 聊天相关 ====================
  static Future<List<dynamic>> getChatSessions() async {
    final res = await _dio.get('/api/chat/sessions');
    return res.data['data'] ?? [];
  }

  static Future<List<dynamic>> getChatHistory(String chatType, int targetId) async {
    final res = await _dio.get('/api/chat/history', queryParameters: {
      'chatType': chatType,
      'targetId': targetId,
    });
    return res.data['data'] ?? [];
  }

  static Future<List<dynamic>> getMyGroups() async {
    final res = await _dio.get('/api/chat/groups');
    return res.data['data'] ?? [];
  }

  static Future<List<dynamic>> getGroupMembers(String groupId) async {
    final res = await _dio.get('/api/chat/group-members', queryParameters: {'groupId': groupId});
    return res.data['data'] ?? [];
  }

  // ==================== 朋友圈/微博 ====================
  static Future<List<dynamic>> getMoments() async {
    final res = await _dio.get('/api/moments/list');
    return res.data['data'] ?? [];
  }

  static Future<bool> publishMoment(String content, List<String> images) async {
    final res = await _dio.post('/api/moments/publish', data: {
      'content': content,
      'images': images,
    });
    return res.data['code'] == 200;
  }

  static Future<bool> likeMoment(int momentId) async {
    final res = await _dio.post('/api/moments/like', data: {'momentId': momentId});
    return res.data['code'] == 200;
  }

  static Future<bool> commentMoment(int momentId, String content) async {
    final res = await _dio.post('/api/moments/comment', data: {
      'momentId': momentId,
      'content': content,
    });
    return res.data['code'] == 200;
  }

  static Future<bool> deleteMoment(int momentId) async {
    final res = await _dio.post('/api/moments/delete', data: {'momentId': momentId});
    return res.data['code'] == 200;
  }

  // ==================== 跑腿相关 ====================
  static Future<List<dynamic>> getRunOrders({String? my, int? status}) async {
    final res = await _dio.get('/api/run/list', queryParameters: {
      if (my != null) 'my': my,
      if (status != null) 'status': status,
    });
    return res.data['data'] ?? [];
  }

  static Future<bool> publishRunOrder(String title, String detail, double fee, String address) async {
    final res = await _dio.post('/api/run/publish', data: {
      'title': title,
      'detail': detail,
      'fee': fee,
      'address': address,
    });
    return res.data['code'] == 200;
  }

  static Future<bool> takeOrder(int orderId) async {
    final res = await _dio.post('/api/run/take', data: {'orderId': orderId});
    return res.data['code'] == 200;
  }

  static Future<bool> finishOrder(int orderId) async {
    final res = await _dio.post('/api/run/finish', data: {'orderId': orderId});
    return res.data['code'] == 200;
  }

  // ==================== 论坛相关 ====================
  static Future<List<dynamic>> getForumPosts({int? categoryId}) async {
    final res = await _dio.get('/api/forum/list', queryParameters: {
      if (categoryId != null) 'categoryId': categoryId,
    });
    return res.data['data'] ?? [];
  }

  static Future<bool> publishPost(String title, String content, int categoryId) async {
    final res = await _dio.post('/api/forum/publish', data: {
      'title': title,
      'content': content,
      'categoryId': categoryId,
    });
    return res.data['code'] == 200;
  }

  static Future<bool> likePost(int postId) async {
    final res = await _dio.post('/api/forum/like', data: {'postId': postId});
    return res.data['code'] == 200;
  }

  static Future<bool> commentPost(int postId, String content) async {
    final res = await _dio.post('/api/forum/comment', data: {
      'postId': postId,
      'content': content,
    });
    return res.data['code'] == 200;
  }

  // ==================== 支付相关 ====================
  static Future<double> getWalletBalance() async {
    final res = await _dio.get('/api/pay/wallet');
    return (res.data['data']?['money'] ?? 0).toDouble();
  }

  static Future<bool> recharge(double amount) async {
    final res = await _dio.post('/api/pay/recharge', data: {'amount': amount});
    return res.data['code'] == 200;
  }

  static Future<bool> withdraw(double amount) async {
    final res = await _dio.post('/api/pay/withdraw', data: {'amount': amount});
    return res.data['code'] == 200;
  }
}