import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';

class MomentsPage extends StatefulWidget {
  const MomentsPage({super.key});

  @override
  State<MomentsPage> createState() => _MomentsPageState();
}

class _MomentsPageState extends State<MomentsPage> {
  List<dynamic> _moments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadMoments();
  }

  Future<void> _loadMoments() async {
    try {
      final moments = await ApiService.getMoments();
      setState(() {
        _moments = moments;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('朋友圈'),
        actions: [
          IconButton(
            icon: const Icon(Icons.camera_alt),
            onPressed: _showPublishDialog,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadMoments,
              child: ListView.builder(
                itemCount: _moments.length,
                itemBuilder: (context, index) => _buildMomentCard(_moments[index]),
              ),
            ),
    );
  }

  Widget _buildMomentCard(Map moment) {
    final user = {
      'nickname': moment['nickname'] ?? '未知',
      'avatar': moment['avatar'] ?? 'https://picsum.photos/200',
    };
    final likes = moment['likes'] as List? ?? [];
    final comments = moment['comments'] as List? ?? [];
    final images = (moment['images'] as List?)?.map((e) => e.toString()).toList() ?? [];

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundImage: NetworkImage(user['avatar']),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user['nickname'],
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        _formatTime(moment['create_time']),
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(moment['content'] ?? ''),
            if (images.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: images.take(9).map((url) => ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Image.network(url, width: 100, height: 100, fit: BoxFit.cover),
                )).toList(),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _likeMoment(moment['id']),
                    child: Row(
                      children: [
                        const Icon(Icons.thumb_up_outlined, size: 20, color: Colors.grey),
                        const SizedBox(width: 4),
                        Text('${likes.length}', style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ),
                ),
                InkWell(
                  onTap: () => _showCommentDialog(moment['id']),
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline, size: 20, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text('${comments.length}', style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
            if (likes.isNotEmpty || comments.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(4)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (likes.isNotEmpty)
                      Text(
                        '❤️ ${likes.map((e) => e['nickname']).join(', ')}',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ...comments.take(3).map((c) => Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '${c['nickname']}: ${c['content']}',
                        style: const TextStyle(fontSize: 12),
                      ),
                    )),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatTime(String? time) {
    if (time == null) return '';
    try {
      final dt = DateTime.parse(time);
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inMinutes < 1) return '刚刚';
      if (diff.inHours < 1) return '${diff.inMinutes}分钟前';
      if (diff.inDays < 1) return '${diff.inHours}小时前';
      return '${dt.month}月${dt.day}日';
    } catch (e) {
      return '';
    }
  }

  Future<void> _likeMoment(int momentId) async {
    await ApiService.likeMoment(momentId);
    _loadMoments();
  }

  void _showPublishDialog() {
    final contentCtrl = TextEditingController();
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('发布朋友圈', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: contentCtrl,
              maxLines: 5,
              decoration: const InputDecoration(
                hintText: '分享生活...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                IconButton(icon: const Icon(Icons.photo), onPressed: () {}),
                IconButton(icon: const Icon(Icons.location_on), onPressed: () {}),
                const Spacer(),
                ElevatedButton(
                  onPressed: () async {
                    if (contentCtrl.text.isEmpty) return;
                    final success = await ApiService.publishMoment(contentCtrl.text, []);
                    if (mounted) {
                      Navigator.pop(context);
                      if (success) _loadMoments();
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF07C160)),
                  child: const Text('发布'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showCommentDialog(int momentId) {
    final commentCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('评论'),
        content: TextField(controller: commentCtrl, decoration: const InputDecoration(hintText: '输入评论')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
          TextButton(
            onPressed: () async {
              if (commentCtrl.text.isNotEmpty) {
                await ApiService.commentMoment(momentId, commentCtrl.text);
                if (mounted) {
                  Navigator.pop(context);
                  _loadMoments();
                }
              }
            },
            child: const Text('发送'),
          ),
        ],
      ),
    );
  }
}