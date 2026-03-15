import 'package:dio/dio.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class AuthService {
  static late SharedPreferences _prefs;
  static String? _token;
  static Map<String, dynamic>? _userInfo;

  static bool get isLoggedIn => _token != null;
  static String? get token => _token;
  static Map<String, dynamic>? get userInfo => _userInfo;
  static int get uid => _userInfo?['id'] ?? 0;

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _token = _prefs.getString('token');
    final userStr = _prefs.getString('userInfo');
    if (userStr != null) {
      _userInfo = json.decode(userStr);
    }
  }

  static Future<bool> login(String username, String password) async {
    try {
      final response = await Dio().post('$apiUrl/api/user/login', data: {
        'username': username,
        'password': password,
      });
      if (response.data['code'] == 200) {
        _token = response.data['data']['token'];
        _userInfo = response.data['data']['user'];
        await _prefs.setString('token', _token!);
        await _prefs.setString('userInfo', json.encode(_userInfo!));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> register(String username, String password, String nickname) async {
    try {
      final response = await Dio().post('$apiUrl/api/user/register', data: {
        'username': username,
        'password': password,
        'nickname': nickname,
      });
      return response.data['code'] == 200;
    } catch (e) {
      return false;
    }
  }

  static Future<void> logout() async {
    await _prefs.remove('token');
    await _prefs.remove('userInfo');
    _token = null;
    _userInfo = null;
  }

  static Map<String, String> get headers => {
    'Authorization': 'Bearer $token',
  };
}

const String apiUrl = 'http://localhost:3000';
const String socketUrl = 'http://localhost:3000';