# BÁO CÁO THỰC TẬP TỐT NGHIỆP

## Xây dựng nền tảng thương mại điện tử đa nhà bán Intern Market

**Sinh viên thực hiện:** [Họ và tên sinh viên]  
**Mã số sinh viên:** [MSSV]  
**Lớp/Khoa:** [Lớp – Khoa]  
**Đơn vị thực tập:** [Tên đơn vị]  
**Người hướng dẫn tại doanh nghiệp:** [Họ và tên Mentor]  
**Giảng viên hướng dẫn:** [Họ và tên giảng viên]  
**Thời gian thực tập:** [Từ ngày … đến ngày …]  
**Năm:** 2026

> Ghi chú định dạng khi chuyển sang Word: dùng khổ A4, Times New Roman cỡ 13 hoặc 14, giãn dòng 1.5, lề trên 2 cm, dưới 2 cm, trái 3–3.5 cm, phải 2 cm. Với định dạng này, nội dung báo cáo được thiết kế cho khoảng 28–32 trang, không tính bìa và mục lục tự động.

\newpage

# LỜI CẢM ƠN

Trong thời gian thực tập, em đã có cơ hội tham gia xây dựng một dự án phần mềm theo quy trình tương đối hoàn chỉnh, từ phân tích yêu cầu, thiết kế dữ liệu, phát triển chức năng, kiểm thử đến triển khai môi trường trình diễn. Đây là trải nghiệm giúp em nhìn rõ hơn khoảng cách giữa việc học các môn lập trình, cơ sở dữ liệu, mạng máy tính ở trường và việc phát triển một sản phẩm có luồng nghiệp vụ thực tế.

Em xin chân thành cảm ơn Ban lãnh đạo và các anh/chị tại **[Tên đơn vị thực tập]** đã tạo điều kiện để em được thực tập, tiếp cận công nghệ mới và chủ động đề xuất giải pháp. Em đặc biệt cảm ơn **[Họ tên Mentor]** đã định hướng yêu cầu nghiệp vụ, phản hồi trong quá trình triển khai và giúp em rèn luyện cách nhìn một bài toán phần mềm theo góc độ sản phẩm thay vì chỉ hoàn thành từng màn hình riêng lẻ.

Em cũng xin cảm ơn quý thầy cô **[Tên trường/Khoa]** đã trang bị kiến thức nền tảng về lập trình hướng đối tượng, cơ sở dữ liệu, kiến trúc phần mềm, kiểm thử và kỹ năng làm việc. Những kiến thức này là cơ sở để em thực hiện dự án **Intern Market – nền tảng thương mại điện tử đa nhà bán**.

Do thời gian thực tập và kinh nghiệm thực tế còn hạn chế, báo cáo chắc chắn vẫn còn những thiếu sót. Em mong nhận được ý kiến đóng góp từ quý thầy cô và đơn vị thực tập để tiếp tục hoàn thiện năng lực chuyên môn cũng như kỹ năng làm việc trong môi trường doanh nghiệp.

\newpage

# TÓM TẮT BÁO CÁO

Đề tài thực tập là xây dựng một nền tảng thương mại điện tử đa nhà bán với tên gọi **Intern Market**. Khác với cửa hàng trực tuyến một nhà bán thông thường, hệ thống cho phép nhiều nhà bán cùng đăng ký gian hàng, quản lý danh mục sản phẩm, tồn kho, khuyến mãi và xử lý đơn hàng. Khách hàng có thể khám phá sản phẩm, lưu yêu thích, thêm vào giỏ, chọn một phần hoặc toàn bộ giỏ hàng để thanh toán, theo dõi đơn hàng, đánh giá sản phẩm và trao đổi trực tiếp với nhà bán. Quản trị viên có vai trò kiểm duyệt gian hàng, quản lý người dùng, danh mục, coupon, thanh toán và hoàn tiền.

Hệ thống được phát triển theo kiến trúc monorepo. Backend sử dụng NestJS theo hướng modular monolith, frontend sử dụng Next.js App Router, dữ liệu lưu trữ bằng PostgreSQL thông qua Prisma ORM. Redis được sử dụng cho giới hạn tần suất truy cập phân tán; RabbitMQ được chuẩn bị trong hạ tầng phát triển; Docker Compose hỗ trợ khởi tạo môi trường cục bộ. Những luồng nghiệp vụ có rủi ro cao như checkout, tồn kho, thanh toán và hoàn tiền được thiết kế với transaction, idempotency, audit trail và kiểm tra trạng thái tường minh.

Kết quả thực hiện bao gồm các nhóm chức năng chính: xác thực và phân quyền; onboarding gian hàng; catalog và inventory ledger; cart, checkout, order splitting; coupon; review; thông báo; quản trị người dùng/gian hàng; wishlist; gợi ý sản phẩm dựa trên tương tác; chat trực tuyến giữa khách hàng và nhà bán có tùy chọn AI tư vấn theo catalog của chính shop; tích hợp SePay cho thanh toán điện tử; seed dữ liệu demo; tài liệu vận hành và CI. Bên cạnh chức năng, dự án có bộ unit test, integration test và HTTP E2E test cho các luồng trọng yếu.

Qua đề tài, em rút ra được kinh nghiệm quan trọng về cách chuyển yêu cầu nghiệp vụ thành mô hình dữ liệu, cách tách trạng thái thanh toán khỏi trạng thái giao hàng, cách xử lý cạnh tranh tồn kho, cách bảo vệ API và cách triển khai một ứng dụng web lên server sử dụng Docker, Nginx và tên miền. Báo cáo trình bày yêu cầu được giao, quá trình và kết quả thực hiện, đồng thời tự đánh giá những điểm đạt được cũng như các hạn chế cần tiếp tục khắc phục.

**Từ khóa:** thương mại điện tử đa nhà bán, NestJS, Next.js, PostgreSQL, Prisma, Docker, checkout, inventory ledger, SePay, AI chatbot.

\newpage

# DANH MỤC TỪ VIẾT TẮT

| Từ viết tắt | Diễn giải |
|---|---|
| API | Application Programming Interface – giao diện lập trình ứng dụng |
| RBAC | Role-Based Access Control – kiểm soát truy cập theo vai trò |
| JWT | JSON Web Token |
| ORM | Object Relational Mapping |
| DB | Database – cơ sở dữ liệu |
| UI/UX | User Interface/User Experience – giao diện và trải nghiệm người dùng |
| CRUD | Create, Read, Update, Delete |
| CI | Continuous Integration – tích hợp liên tục |
| IPN | Instant Payment Notification – thông báo thanh toán tức thời |
| CSP | Content Security Policy |
| E2E | End-to-End test – kiểm thử đầu cuối |
| SKU | Stock Keeping Unit – đơn vị lưu kho (khái niệm nghiệp vụ) |
| COD | Cash on Delivery – thanh toán khi nhận hàng |
| TTL | Time To Live – thời gian sống của dữ liệu/phiên |
| DTO | Data Transfer Object – đối tượng kiểm tra dữ liệu ở biên API |

\newpage

# MỤC LỤC

1. Giới thiệu đề tài  
2. Công việc được giao  
3. Phân tích và thiết kế giải pháp  
4. Kết quả thực hiện  
5. Kiểm thử, triển khai và vận hành  
6. Tự đánh giá kết quả thực tập  
7. Kết luận và định hướng phát triển  
8. Phụ lục  

> Khi chuyển sang Word, sử dụng Heading 1/Heading 2 cho các tiêu đề rồi chọn **References → Table of Contents** để tạo mục lục và danh sách bảng tự động.

\newpage

# 1. GIỚI THIỆU ĐỀ TÀI

## 1.1. Bối cảnh

Thương mại điện tử là một lĩnh vực có nhiều bài toán kỹ thuật và nghiệp vụ cùng tồn tại. Ở mức giao diện, người dùng chỉ nhìn thấy các thao tác quen thuộc như xem sản phẩm, thêm vào giỏ hàng, thanh toán và theo dõi đơn. Tuy nhiên ở phía sau, hệ thống cần đồng thời giải quyết quyền sở hữu dữ liệu giữa nhiều nhà bán, tính nhất quán của tồn kho, tính chính xác của số tiền, tách trạng thái thanh toán khỏi trạng thái giao hàng, bảo mật tài khoản và khả năng truy vết khi có sự cố.

Trong mô hình đa nhà bán, độ phức tạp tăng lên vì một giỏ hàng có thể chứa sản phẩm thuộc nhiều shop khác nhau. Người mua mong muốn checkout một lần, trong khi mỗi nhà bán cần nhận phần đơn hàng của riêng mình. Hệ thống cần tạo một đơn tổng để khách hàng theo dõi và các đơn con để từng shop xử lý. Khi một shop giao hàng hoặc hủy đơn, tồn kho và trạng thái tổng cũng phải thay đổi theo đúng quy tắc. Việc giải quyết các quan hệ này là mục tiêu kỹ thuật chính của dự án.

Đề tài Intern Market được triển khai như một sản phẩm thực tập có phạm vi đủ rộng để thể hiện kỹ năng full-stack, nhưng vẫn kiểm soát được bằng kiến trúc modular monolith. Thay vì tách nhiều microservice ngay từ đầu, hệ thống được tổ chức theo module nghiệp vụ rõ ràng. Cách tiếp cận này giảm chi phí vận hành trong giai đoạn đầu, đồng thời giữ các ranh giới đủ tốt để có thể tách dịch vụ trong tương lai khi lưu lượng hoặc đội ngũ phát triển tăng lên.

## 1.2. Mục tiêu của đề tài

Mục tiêu tổng quát là xây dựng một nền tảng thương mại điện tử đa nhà bán có thể trình diễn end-to-end luồng từ đăng ký người dùng đến thanh toán và hoàn tất đơn hàng. Ngoài chức năng hiển thị, hệ thống cần bảo vệ các quy tắc nghiệp vụ cốt lõi.

Các mục tiêu cụ thể gồm:

- Xây dựng hệ thống có ba nhóm người dùng: khách hàng, nhà bán và quản trị viên.
- Cho phép nhà bán gửi yêu cầu mở shop; chỉ shop được quản trị viên phê duyệt mới hiển thị sản phẩm công khai.
- Cho phép nhà bán quản lý sản phẩm, mô tả, hình ảnh, thuộc tính, giá bán và tồn kho.
- Bảo đảm tồn kho không bị âm hoặc oversell khi nhiều khách hàng checkout đồng thời.
- Cho phép khách hàng mua sản phẩm của nhiều shop trong một lần checkout, nhưng tách đơn để từng shop xử lý.
- Hỗ trợ coupon theo phạm vi toàn hệ thống hoặc theo shop, có giới hạn và lịch sử sử dụng.
- Tích hợp thanh toán COD và thanh toán điện tử SePay theo hướng không tin cậy dữ liệu redirect từ trình duyệt.
- Xây dựng giao diện riêng, rõ workflow cho customer, vendor và admin.
- Hoàn thiện cơ chế test, logging, rate limit, tài liệu chạy dự án và hướng dẫn triển khai.

## 1.3. Phạm vi thực hiện

Phạm vi triển khai bao gồm toàn bộ luồng mua bán cơ bản: identity, catalog, inventory, cart, checkout, order, payment, review, coupon, notification và quản trị. Trong quá trình phát triển, dự án được mở rộng thêm wishlist, gợi ý sản phẩm theo tương tác, chat trực tuyến theo shop và AI chatbot sử dụng DeepSeek. Những phần mở rộng này được thiết kế theo nguyên tắc không làm suy yếu nghiệp vụ mua hàng cốt lõi.

Các nội dung chưa được xem là hoàn chỉnh cho môi trường thương mại điện tử quy mô lớn gồm: ứng dụng riêng cho shipper, tích hợp đơn vị vận chuyển, đồng bộ sản phẩm thời gian thực từ nhà cung cấp, hệ thống tìm kiếm chuyên dụng như Elasticsearch/Meilisearch, hệ thống recommendation dựa trên machine learning/embedding, hoàn tiền tự động qua SePay và cơ chế scale realtime nhiều API replica bằng Redis Socket.IO adapter. Các hạn chế này được nêu rõ để phân biệt giữa một sản phẩm trình diễn có kiểm soát và một nền tảng production hoàn chỉnh.

## 1.4. Phương pháp thực hiện

Quá trình phát triển được chia thành các giai đoạn. Mỗi giai đoạn xác định domain ưu tiên, tiêu chí nghiệm thu và kiểm thử tương ứng. Khi phát triển một tính năng, em áp dụng trình tự: đọc yêu cầu và business rule, xác định model/relationship cần thiết, thiết kế DTO và API, hiện thực service, kết nối frontend, viết hoặc cập nhật test, sau đó cập nhật tài liệu. Với các phần có rủi ro cao, em ưu tiên correctness trước UI: ví dụ checkout phải transaction được trước khi làm đẹp màn checkout; webhook phải xác thực trước khi cho phép đổi trạng thái payment.

\newpage

# 2. CÔNG VIỆC ĐƯỢC GIAO

## 2.1. Mô tả công việc từ mentor

Nội dung công việc được giao là xây dựng một hệ thống thương mại điện tử đa nhà bán phục vụ mục đích demo và đánh giá năng lực thực tập. Mentor yêu cầu hệ thống phải thể hiện được luồng nghiệp vụ thực tế thay vì chỉ là website catalog tĩnh. Cụ thể, nền tảng phải có phân quyền theo vai trò, quy trình kiểm duyệt shop, quản lý catalog và tồn kho, giỏ hàng, checkout, quản lý đơn hàng, coupon và thanh toán.

Yêu cầu quan trọng là mỗi loại người dùng phải có trải nghiệm và quyền hạn riêng. Khách hàng tập trung vào mua sắm, quản lý địa chỉ, theo dõi đơn và đánh giá. Nhà bán tập trung vào vận hành shop, sản phẩm, tồn kho, coupon, đơn con và hội thoại với khách. Quản trị viên tập trung vào kiểm duyệt, quản trị user/shop/category/coupon/refund và audit. Vì vậy, việc chỉ dùng một menu chung cho mọi vai trò là không đáp ứng yêu cầu; frontend phải điều hướng theo role và route phải có guard tương ứng.

Ngoài chức năng, mentor yêu cầu dự án có cấu trúc dễ bảo trì, có tài liệu kỹ thuật, có kiểm thử cho luồng chính và có khả năng chạy/triển khai rõ ràng. Điều này dẫn đến các yêu cầu về monorepo, Docker, Prisma migration, seed dữ liệu, CI, production runbook và tài liệu hướng dẫn cho developer mới.

## 2.2. Yêu cầu chức năng

### 2.2.1. Nhóm chức năng khách hàng

Khách hàng có thể đăng ký, đăng nhập, làm mới phiên đăng nhập, đăng xuất và quản lý hồ sơ. Người dùng được thêm, sửa, xóa địa chỉ; một địa chỉ có thể được đặt làm mặc định. Ở checkout, khách có thể chọn địa chỉ có sẵn hoặc thêm mới bằng form hỗ trợ tra cứu bản đồ.

Khách hàng có thể xem trang chủ, tìm kiếm và lọc sản phẩm theo danh mục; xem trang chi tiết sản phẩm và shop; thấy giá, mô tả, ảnh, thuộc tính, shop bán và tồn kho khả dụng. Người dùng có thể thêm sản phẩm vào wishlist, thêm vào cart, thay đổi số lượng và chọn những dòng nào sẽ checkout. Tại checkout, người dùng chọn địa chỉ, hình thức thanh toán, coupon và đặt hàng. Sau đó khách theo dõi đơn tổng, trạng thái đơn theo shop, trạng thái thanh toán, có thể hủy đơn trong điều kiện hợp lệ và đánh giá sản phẩm sau khi giao thành công.

Ngoài luồng mua hàng, khách hàng có thể nhận thông báo, xem gợi ý sản phẩm dựa trên tương tác, nhắn tin với shop qua modal chat hoặc màn hình hội thoại riêng. Người dùng có thể bật/tắt hiển thị khối gợi ý trên trang chủ mà không xóa dữ liệu tương tác đã tích lũy.

### 2.2.2. Nhóm chức năng nhà bán

Nhà bán có thể gửi yêu cầu tạo shop với tên, slug và mô tả. Shop mới ở trạng thái chờ duyệt; chỉ sau khi admin approve thì owner được vận hành catalog công khai. Nhà bán quản lý sản phẩm thuộc shop của mình: tạo mới, cập nhật tên, slug, category, mô tả, giá bán, giá so sánh, ảnh, thuộc tính, trạng thái và tồn kho thực tế. Hệ thống hiển thị số hàng tồn, số hàng đã reserve và lịch sử điều chỉnh thay vì cho phép overwrite tồn kho một cách không kiểm soát.

Nhà bán xem các shop order thuộc shop mình, chuyển trạng thái theo từng bước: xác nhận, đóng gói, sẵn sàng bàn giao, giao thành công hoặc hủy theo điều kiện. Nhà bán tạo coupon phạm vi shop, xem và trả lời tin nhắn khách hàng. Mỗi shop có một công tắc AI chatbot; khi bật và server có DeepSeek API key, AI chỉ tư vấn từ catalog active của chính shop đó.

### 2.2.3. Nhóm chức năng quản trị viên

Quản trị viên quản lý danh sách người dùng, tìm kiếm và lọc theo role/trạng thái, xem chi tiết và có thể khóa/mở khóa tài khoản theo business rule. Khi khóa một người dùng, hệ thống phải revoke refresh sessions, suspend các shop approved thuộc owner và ghi audit log. Admin không được tự khóa chính mình và không được khóa admin active cuối cùng.

Admin duyệt hoặc từ chối shop, suspend shop, quản lý category dạng cây, quản lý coupon toàn hệ thống, xem danh sách payment và xử lý các yêu cầu refund theo quyền. Việc chuyển trạng thái shop/user và các thay đổi tài chính đều cần lý do hoặc lịch sử để truy vết.

### 2.2.4. Nhóm chức năng nền tảng

Hệ thống cần có health endpoint, readiness endpoint kiểm tra PostgreSQL/Redis, request ID, structured error response, request logging, rate limiting và security headers. Dữ liệu demo phải có thể seed lặp lại an toàn; catalog demo cần đủ phong phú để kiểm thử tìm kiếm, lọc, shop storefront và recommendation. Hệ thống cũng cần tài liệu chạy local, hướng dẫn deploy server dùng Docker/Nginx và checklist sự cố thanh toán.

## 2.3. Yêu cầu phi chức năng

Về bảo mật, access token có thời hạn ngắn, refresh token lưu bằng HttpOnly cookie và được xoay vòng. Backend không tin token cũ về role/status mà kiểm tra trạng thái hiện tại của user khi xác thực. Secret DeepSeek và SePay chỉ tồn tại phía backend, không xuất hiện ở frontend hay log.

Về tính nhất quán, checkout dùng transaction Serializable cùng kiểm tra optimistic/cas để không oversell. Payment status tách khỏi fulfillment status. Mỗi thay đổi inventory có record ledger; mỗi payment/refund transition có lịch sử. Với webhook, payload phải được xác thực, event retry phải idempotent và cùng event ID nhưng body khác phải bị từ chối.

Về khả năng vận hành, project có Dockerfiles, Docker Compose, migration, health check, CI pipeline, smoke test, load smoke và runbook. Về trải nghiệm, giao diện có loading/error/empty states, responsive cơ bản và các workspace riêng cho customer, vendor, admin.

## 2.4. Kế hoạch thực hiện

Kế hoạch ban đầu gồm bốn phase trong hai tháng. Phase 1 tập trung vào foundation/domain baseline. Phase 2 triển khai identity, catalog và shop operations. Phase 3 triển khai cart, checkout, order và payment. Phase 4 hướng tới production readiness và hoàn thiện UX. Trong quá trình làm, các phần nâng cao được triển khai theo mức ưu tiên thực tế: financial reliability, notification/outbox, session hardening, chat/AI, admin governance, wishlist, recommendation, demo catalog và storefront.

Việc chia phase giúp tránh triển khai các tính năng phụ khi nền tảng chưa ổn định. Ví dụ, recommendation chỉ có ý nghĩa khi catalog public, cart và checkout đã cung cấp dữ liệu tương tác đáng tin cậy. Tương tự, AI chatbot chỉ được thêm sau khi xác định rõ ownership conversation và phạm vi dữ liệu catalog của từng shop.

\newpage

# 3. PHÂN TÍCH VÀ THIẾT KẾ GIẢI PHÁP

## 3.1. Kiến trúc tổng thể

Intern Market sử dụng monorepo với ba thành phần chính:

| Thành phần | Công nghệ | Trách nhiệm |
|---|---|---|
| `apps/api` | NestJS, TypeScript, Prisma | REST API, nghiệp vụ, xác thực, transaction, webhook, worker |
| `apps/web` | Next.js App Router, React, TypeScript | Giao diện customer/vendor/admin, gọi API, trạng thái trình duyệt |
| `packages/shared` | TypeScript | Kiểu dữ liệu và hằng số dùng chung khi cần |
| `docs` | Markdown/DOCX | Roadmap, business rule, runbook, handbook, tài liệu demo |

Lý do chọn modular monolith là vì dự án cần xử lý các transaction xuyên domain như checkout tạo order, reserve inventory, ghi coupon usage, tạo payment và enqueue notification trong cùng một database transaction. Nếu tách microservice quá sớm, việc đảm bảo nhất quán sẽ phức tạp hơn rất nhiều. Tuy nhiên, code backend được chia thành các module như auth, shops, catalog, inventory, cart, checkout, orders, payments, coupons, notifications, chat, recommendations và admin governance. Các ranh giới này giúp code không bị dồn vào một module lớn.

## 3.2. Mô hình người dùng và phân quyền

Hệ thống có ba role: `CUSTOMER`, `VENDOR`, `ADMIN`. Customer là role mặc định khi đăng ký công khai. Vendor không được tự khai báo tùy ý trong request đăng ký; user trở thành vendor khi có shop được phê duyệt. Admin là role được quản lý có kiểm soát.

Backend dùng JWT Guard để xác thực access token, `RolesGuard` để kiểm tra quyền endpoint và decorator lấy current user. Tuy nhiên RBAC không thay thế ownership. Ví dụ, route cập nhật product có thể cho phép role Vendor, nhưng service vẫn phải kiểm tra `product.shop.ownerId === currentUser.id`. Cách tách này tránh lỗi phổ biến: một vendor có quyền cập nhật sản phẩm nhưng lại sửa được sản phẩm của vendor khác.

Ở frontend, navigation hiển thị theo session và role. Customer thấy menu khám phá, giỏ hàng, yêu thích, đơn mua, tin nhắn và workspace phù hợp. Vendor có sidebar vận hành shop. Admin có sidebar quản trị. Route gate cũng ngăn anonymous hoặc role không phù hợp truy cập các trang protected.

## 3.3. Thiết kế dữ liệu

Dữ liệu được thiết kế trong PostgreSQL bằng Prisma Schema. Các bảng chính gồm `users`, `refresh_sessions`, `user_addresses`, `shops`, `categories`, `products`, `inventories`, `inventory_ledger`, `carts`, `cart_items`, `parent_orders`, `shop_orders`, `order_items`, `payments`, `payment_status_history`, `refunds`, `coupons`, `coupon_usages`, `reviews`, `notifications`, `outbox_events`, `wishlist_items`, `user_interactions`, `chat_conversations` và `chat_messages`.

Thiết kế sử dụng quan hệ và unique constraint để bảo vệ invariant. Ví dụ, cart item unique theo `(cartId, productId)` để không có hai dòng trùng sản phẩm trong một giỏ. Wishlist unique theo `(userId, productId)` để thao tác add có thể idempotent. Coupon usage có unique theo coupon/order để không ghi trùng một lần checkout. Payment webhook event unique theo `(provider, eventId)` để provider retry không tạo trạng thái mới. Chat message unique theo `(conversationId, clientMessageId)` để client resend khi mất mạng không làm trùng tin nhắn.

Tiền được lưu bằng Decimal thay vì số thực dấu chấm động. Cách này quan trọng vì phép toán số thực có thể gây sai số, nhất là khi tính subtotal, discount, shipping và refund. Order item lưu snapshot tên, ảnh và giá ở thời điểm checkout để product bị sửa sau này không làm thay đổi hóa đơn cũ.

## 3.4. Thiết kế trạng thái nghiệp vụ

Hệ thống tách ba nhóm trạng thái: trạng thái shop, trạng thái fulfillment của shop order/parent order và trạng thái payment. Đây là quyết định quan trọng vì một đơn có thể đã giao nhưng chưa thu COD, hoặc đã thanh toán điện tử nhưng shop chưa giao.

Shop chuyển theo các cạnh hợp lệ như `PENDING_REVIEW → APPROVED/REJECTED`, `APPROVED → SUSPENDED`. Product có `DRAFT`, `ACTIVE`, `ARCHIVED`. Shop order đi từ `PENDING_CONFIRMATION` qua `CONFIRMED`, `PACKING`, `READY_TO_HANDOFF`, `DELIVERED`; có nhánh cancel ở trạng thái được cho phép. Payment chuyển từ `UNPAID` sang `AUTHORIZED`, `PAID` hoặc `FAILED`; các refund có trạng thái riêng và được tổng hợp thành `PARTIALLY_REFUNDED` hoặc `REFUNDED`.

Việc sử dụng transition rõ ràng giúp service có thể trả lỗi có ý nghĩa nếu thao tác sai thứ tự. Ví dụ, vendor không thể đánh dấu giao hàng ngay khi đơn vừa tạo; payment đã `PAID` không thể bị đánh dấu `PAID` lần nữa bằng một provider reference khác. Đây vừa là ràng buộc nghiệp vụ vừa là hàng rào bảo vệ dữ liệu.

## 3.5. Thiết kế tồn kho và inventory ledger

Mỗi product có một inventory với các trường chính `onHand`, `reserved` và `sold`. Tồn kho khả dụng được tính bằng `onHand - reserved`. Khi khách thêm vào cart, hệ thống không reserve ngay vì cart có thể bị bỏ quên. Khi checkout commit thành công, lượng mua được chuyển sang `reserved` trong transaction. Khi shop order bị hủy hợp lệ, reserved được release. Khi giao thành công, reserved giảm, onHand giảm và sold tăng.

Mỗi biến động được ghi vào `InventoryLedger` với lý do như initial stock, manual adjustment, order reserved, order cancelled/released hoặc order delivered/sold. Ledger giúp giải thích tại sao tồn kho thay đổi và là nền tảng cần thiết để điều tra khi có khiếu nại. Vendor cập nhật stock bằng giá trị tồn thực tế, nhưng service kiểm tra không thể đưa onHand xuống thấp hơn reserved. Điều này ngăn việc làm cho available stock âm.

Để chống race condition, service sử dụng conditional update/compare-and-swap và retry trong các đoạn transaction quan trọng. Nếu hai checkout cùng cố reserve sản phẩm gần hết hàng, chỉ request đủ điều kiện mới thành công; request còn lại nhận lỗi conflict/insufficient stock thay vì tạo oversell.

## 3.6. Thiết kế cart, checkout và order splitting

Cart là trạng thái tạm theo user. Giá hiển thị trong cart chỉ để preview; trước checkout backend luôn đọc lại product, price, shop status và inventory. Customer có thể chọn các `cartItemId` muốn thanh toán, nhờ đó phần còn lại vẫn giữ trong giỏ sau khi đặt hàng.

Trong quote, các item hợp lệ được group theo shop. Hệ thống tính subtotal từng shop, shipping theo số shop, coupon scope toàn hệ thống hoặc shop và tổng thanh toán. Với cấu hình demo hiện tại, phí vận chuyển là 2.000 VND cho mỗi shop. Coupon được validate cả ở quote và commit vì giữa hai thời điểm có thể thay đổi tồn kho, hạn dùng hoặc lượt sử dụng.

Trong commit, hệ thống dùng transaction Serializable. Các bước chính là: tải lại item; revalidate; tính lại quote; claim coupon nếu có; reserve inventory; tạo parent order; tách shop order; tạo order item snapshots; tạo payment; ghi coupon usage; clear đúng cart items đã mua; enqueue notification. Bất kỳ lỗi nào cũng rollback toàn bộ, do đó không tồn tại order dở hoặc tồn kho reserve mồ côi.

Idempotency key kết hợp fingerprint payload giúp request bị retry do người dùng refresh hoặc mạng yếu không tạo đơn trùng. Nếu cùng key nhưng payload khác, hệ thống trả conflict vì đây là hai ý định checkout khác nhau.

## 3.7. Thiết kế payment và webhook

Payment record được tạo cùng checkout. COD và SePay là hai phương thức chính. Với COD, payment không tự động paid chỉ vì order được tạo. Với SePay, backend tạo hosted checkout form có chữ ký và invoice number bằng Payment UUID. Browser redirect success/error/cancel chỉ là tín hiệu điều hướng UX, không có quyền sửa payment.

Trạng thái thanh toán SePay được ghi nhận qua hai đường server-to-server: IPN từ SePay và reconcile API khi user quay về result page. Cả hai đều kiểm tra invoice map đúng payment, currency VND, amount khớp chính xác, order `CAPTURED`, transaction `APPROVED` và provider reference chưa được dùng cho payment khác. IPN dùng `X-Secret-Key`; retry cùng event có kết quả idempotent. Các event này tạo lịch sử status và audit webhook event.

Trong quá trình triển khai production, dự án đã phát hiện payload IPN hợp lệ của SePay có thêm `agreement: null`. Vì backend bật chế độ từ chối field không khai báo, callback bị trả `400`. Lỗi được sửa bằng cách khai báo rõ `agreement` nullable trong DTO và bổ sung E2E test với payload tương ứng. Kinh nghiệm này cho thấy integration test cần phản ánh payload provider thật, không chỉ payload rút gọn tự tạo.

## 3.8. Thiết kế notification, chat và AI

Notification dùng transactional outbox. Thay vì gửi notification trực tiếp trong service rồi có nguy cơ business transaction thành công nhưng notification thất bại, hệ thống tạo outbox event trong cùng transaction. Worker đọc event bằng `FOR UPDATE SKIP LOCKED`, tạo notification idempotent theo unique delivery key và đánh dấu trạng thái. Cách này phù hợp hơn khi chạy nhiều worker/API replica.

Chat có một conversation duy nhất cho mỗi cặp customer/shop. Lịch sử, read state và realtime room đều được kiểm tra ownership. Client tạo `clientMessageId`; nếu gửi lại cùng ID, server trả message cũ thay vì tạo trùng. Giao diện hỗ trợ modal góc phải và trang chat riêng theo kiểu messenger. Vendor có thể bật/tắt AI theo shop. AI only receives active products của shop, gồm giá, mô tả, thuộc tính và stock khả dụng; không được lấy catalog shop khác. DeepSeek key chỉ đi từ backend đến provider qua header server-side.

## 3.9. Thiết kế recommendation và wishlist

Wishlist là danh sách yêu thích persistent, không giữ chỗ tồn kho. Khi product sau này unavailable, item vẫn được hiển thị nhưng đánh dấu không thể mua. Header badge đồng bộ số wishlist tương tự cart badge.

Recommendation sử dụng heuristic có thể giải thích thay vì machine learning. Hệ thống lưu aggregate interaction theo user/product/type với các loại VIEW, WISHLIST, ADD_TO_CART và PURCHASE. Tín hiệu mạnh hơn và mới hơn có trọng số cao hơn; repeated interactions bị cap để spam click không chi phối kết quả. Hệ thống còn kết hợp affinity category/shop, popular products và freshness. Danh sách cuối vẫn chỉ chứa product active, shop approved và còn stock. Customer anonymous nhận trending cold-start; user đăng nhập nhận personalized results. Thiết kế này phù hợp quy mô demo vì minh bạch, ít phụ thuộc hạ tầng, đồng thời có hướng mở rộng sau này.

\newpage

# 4. KẾT QUẢ THỰC HIỆN

## 4.1. Kết quả theo từng giai đoạn

### 4.1.1. Giai đoạn nền tảng và domain baseline

Giai đoạn đầu đã tạo cấu trúc monorepo, thiết lập NestJS API, Next.js web, shared package và tài liệu dự án. Docker Compose khởi tạo PostgreSQL, Redis và RabbitMQ để mọi thành viên có môi trường phát triển nhất quán. Prisma schema ban đầu mô tả các aggregate quan trọng: user, shop, catalog, inventory, cart, order, payment, coupon và review.

Song song với source code, roadmap và business rules được viết trước khi mở rộng nghiệp vụ. Điều này giúp xác định các invariant như product public chỉ khi shop approved/product active/còn hàng; payment tách fulfillment; inventory change phải có ledger. Đây là những quy tắc được dùng xuyên suốt các phase sau.

### 4.1.2. Giai đoạn identity, catalog và shop operations

Backend đã hoàn thiện register/login JWT, RBAC, role decorator, current user decorator, refresh-session rotation và logout. Access token được giữ trong memory phía browser; refresh token nằm trong HttpOnly cookie. Khi refresh token bị reuse, session bị từ chối nhằm giảm rủi ro bị đánh cắp phiên.

Shop onboarding cho phép customer tạo request mở shop. Admin có thể approve/reject/suspend. Khi approve, owner được promote thành vendor. Catalog có category tree, public listing, detail theo slug, vendor CRUD sản phẩm, ảnh, description, compare-at price, attribute và status. Inventory module hỗ trợ xem tồn, điều chỉnh tồn, reserve/release và ledger.

Frontend được cải tiến từ skeleton ban đầu thành các workspace rõ ràng. Customer có storefront; Vendor có sidebar quản lý shop/sản phẩm/đơn/coupon/tin nhắn; Admin có sidebar user/shop/category/coupon/refund. Product card được sửa để hiển thị ảnh, category, shop, giá, available stock, thao tác cart/wishlist và link chi tiết.

### 4.1.3. Giai đoạn cart, checkout, order và payment

Đây là phần có độ phức tạp cao nhất. Cart APIs gồm get, add, update quantity, remove và clear. Hệ thống giới hạn quantity theo available inventory và đồng bộ badge trên header. Customer có thể tích chọn những items cần checkout thay vì bắt buộc mua toàn bộ cart.

Checkout quote và commit được tách rõ. Quote dùng để hiển thị số tiền; commit là authority cuối cùng. Commit tạo parent order và shop orders, snapshots, payment, coupon usage, reservations và notification cùng một transaction. Test concurrency xác nhận khi tồn kho không đủ, chỉ một checkout cạnh tranh có thể thành công.

Customer có trang order list/detail và cancel trong điều kiện hợp lệ. Vendor có dashboard xử lý shop order theo transition. Khi delivered, inventory được chuyển từ reserved sang sold; khi cancel, reserved được release. Payment có COD, bank transfer và SePay hosted checkout. SePay được harden bằng IPN secret, state validation, raw payload audit hash, event idempotency, provider reference uniqueness và server-to-server reconciliation.

### 4.1.4. Giai đoạn production readiness và mở rộng vận hành

Hệ thống bổ sung review sau giao hàng, notification inbox, request ID, structured error, security headers, Redis rate limit, readiness health check, CI, production runbook, Dockerfile production, smoke test, load test và backup/restore drill. Những hạng mục này giúp dự án không chỉ dừng ở việc chạy local mà có quy trình kiểm tra trước deployment và hướng dẫn xử lý sự cố.

Sau core phase, dự án mở rộng admin governance, chat/AI, wishlist, recommendations, demo catalog 60 sản phẩm và public shop storefront. Các mở rộng đều được gắn với ownership, business rule và test thay vì thêm UI độc lập.

## 4.2. Kết quả backend

### 4.2.1. Authentication và session lifecycle

Luồng đăng nhập trả access token ngắn hạn và set refresh cookie. Khi access token hết hạn hoặc memory token bị mất do reload, web gọi refresh endpoint một lần dùng chung cho các request đồng thời. Refresh session được lưu hash trong database, có rotation, revoke, logout-all và cleanup worker. Khi user bị ban, API không chỉ dựa vào chữ ký JWT mà kiểm tra status hiện tại ở database để chặn ngay.

Kết quả này thể hiện việc áp dụng defense in depth: token có chữ ký hợp lệ vẫn không được xem là đủ nếu account đã bị khóa. Đồng thời, không lưu access token trong localStorage giúp giảm bề mặt tấn công từ XSS.

### 4.2.2. Catalog, product authoring và shop storefront

Public catalog chỉ trả product thỏa điều kiện visibility. Điều kiện được kiểm tra ở backend thay vì chỉ filter frontend, bao gồm product active, shop approved và available stock dương. Product detail dùng slug encoding đúng để xử lý tên có khoảng trắng/Unicode mà không double-encode URL.

Vendor form được bổ sung description, image URLs, compare-at price, attributes và tồn kho. URL ảnh phải HTTP/HTTPS, được trim/deduplicate; compare-at price phải lớn hơn selling price. Admin quản lý category tree và tránh cycle hoặc deactivate category đang có dependency không phù hợp.

Shop storefront công khai tại `/shops/[slug]` cho phép khách xem thông tin shop, search và filter product của shop đó. Điều này đáp ứng đặc thù multi-vendor: khách không chỉ xem một product riêng lẻ mà còn đánh giá tập sản phẩm của một nhà bán.

### 4.2.3. Inventory correctness

Kết quả nổi bật là inventory được xử lý như domain riêng thay vì một cột stock đơn giản. Mọi thay đổi có ledger reason/reference/note. Service điều chỉnh stock kiểm tra reserved; checkout reserve bằng điều kiện available; delivery/cancellation chuyển đổi đúng các trường. Những kiểm tra này được cover bằng integration test PostgreSQL, đặc biệt tình huống hai request reserve/checkout cạnh tranh.

### 4.2.4. Coupon và pricing

Coupon hỗ trợ GLOBAL/SHOP, percentage/fixed amount, thời gian hiệu lực, minimum order, maximum discount, usage limit và per-user limit. Coupon discovery chỉ là danh sách gợi ý; commit vẫn revalidate vì coupon có thể hết lượt giữa lúc customer xem và đặt hàng. Sau khi có usage, code/scope/shop/type/value bị khóa để bảo toàn điều khoản đã áp dụng cho lịch sử order.

Để phục vụ demo đơn giá nhỏ, dữ liệu seed chuyển từ `WELCOME10` sang `WELCOME2K` giảm cố định 2.000 VND. Campaign cũ được deactivate thay vì đổi economic terms; nhờ đó những đơn lịch sử vẫn giữ số tiền cũ. Đây là ví dụ cụ thể về cách xử lý migration dữ liệu mà không phá audit.

### 4.2.5. Payment, refund và SePay

Payment domain có status history append-only. Refund tách thành aggregate riêng với amount, idempotency key, reason và status history. Tổng refund thành công không được vượt số tiền payment; concurrent refund được bảo vệ bằng Serializable transaction và compare-and-swap.

Với SePay, backend tạo checkout URL bằng SDK chính thức và không expose merchant secret. IPN `ORDER_PAID` phải vượt qua secret, status, currency, amount, invoice và provider reference checks. Return page chỉ poll endpoint reconcile; không tự đánh dấu paid từ query string. Sau khi phát hiện lỗi `agreement` từ log IPN production, DTO được cập nhật nhưng vẫn giữ `forbidNonWhitelisted` để các field không được mong đợi tiếp tục bị từ chối. Đây là minh chứng cho việc sử dụng log production để hoàn thiện compatibility mà không nới lỏng validation một cách tùy tiện.

## 4.3. Kết quả frontend

### 4.3.1. Customer storefront

Trang chủ có hero/search, category filter, product grid, recommendation shelf, cart/wishlist badge và entry point chat. Khi ô search bị xóa, danh sách tự trả về tất cả product thay vì bắt user bấm Search lần nữa. Product card hiển thị stock; trạng thái cart/wishlist được đồng bộ qua external store để header cập nhật ngay sau thao tác.

Product detail hiển thị gallery, shop, giá, compare-at price, description, attributes, stock, review và action add cart/wishlist/chat. Cả cart và order history đều link tên product về product detail hiện tại, trong khi name/price snapshot của order vẫn được bảo toàn trong API.

Cart chỉ tập trung vào chọn items và quantity. Checkout là trang riêng, giúp form địa chỉ, coupon, payment và quote không làm cart quá nặng. Map search sử dụng proxy geocoding và được sửa để button search không submit form ngoài ý muốn, tránh reload trang. Coupon card cho phép xem chi tiết trước khi áp dụng.

### 4.3.2. Vendor workspace

Vendor có luồng onboarding shop, quản lý catalog, chỉnh sửa product/stock, theo dõi inventory, xử lý đơn, quản lý coupon và inbox. Các màn hình hiển thị status shop, product và order để vendor hiểu điều kiện thao tác. Form product không chỉ có name/slug/price mà còn có mô tả, ảnh, thuộc tính và stock, phù hợp một luồng quản lý hàng hóa thực tế hơn.

Vendor chat có danh sách conversation, vùng message, composer chống lỗi Vietnamese IME và switch bật/tắt AI theo shop. AI state hiển thị rõ; khi thiếu API key hoặc AI bị tắt, human chat vẫn hoạt động bình thường.

### 4.3.3. Admin workspace

Admin có dashboard và các khu vực quản lý user, shop, category, coupon, payment/refund. Trang user hỗ trợ search, role/status filter, detail drawer và action lock/unlock. Trang shop hiển thị trạng thái/lý do review. Những action nhạy cảm yêu cầu lý do, phản ánh logic audit ở backend.

## 4.4. Kết quả chất lượng và vận hành

### 4.4.1. Kiểm thử

Chiến lược test được chia thành unit, service, integration và E2E. Unit test phù hợp với helper như recommendation ranking, validation, frontend state. Integration test dùng PostgreSQL thực cho checkout, inventory, coupon, payment/refund, notification/outbox và admin governance. E2E khởi tạo Nest application để kiểm tra request/response, guard, cookie, raw webhook body và luồng commerce.

Các tình huống đã được kiểm thử gồm: concurrent inventory reservation, concurrent checkout không oversell, idempotent checkout, coupon per-user limit, webhook signature sai, replay event, refund cạnh tranh, refresh token reuse, chat duplicate message, wishlist idempotency, recommendation diversification, và SePay IPN nullable fields. Các lệnh lint và production build API/Web cũng được chạy để phát hiện lỗi type hoặc bundling trước khi commit.

### 4.4.2. CI và tài liệu

GitHub Actions CI chạy npm install, production dependency audit, Prisma generate/migrate, lint, unit/integration test, web test, E2E và production build. Điều này giảm rủi ro merge code không compile hoặc phá test cũ.

Tài liệu gồm roadmap, business rules, codebase handbook, run guide và production runbook. Codebase handbook giải thích luồng controller → service → Prisma, data model, transaction boundary, state transition, frontend state và failure case để một fresher có thể tiếp cận. Production runbook mô tả biến môi trường, release, migration, Nginx, health check, backup/restore, smoke test và incident response.

### 4.4.3. Triển khai demo

Môi trường demo chạy Docker Compose với API, Web, PostgreSQL và Redis. Nginx đóng vai trò reverse proxy, domain công khai chuyển `/api` đến backend và phần còn lại đến Next.js. Production environment cấu hình `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, JWT secrets, database/Redis URL, rate-limit policy, shipping fee, SePay và DeepSeek. Health readiness endpoint được dùng để xác nhận API có kết nối dependency quan trọng trước khi nhận traffic.

Khi cập nhật code, quy trình cơ bản là pull commit, build image liên quan, chạy migration nếu có, recreate container và kiểm tra health/log. Các data change như coupon demo được đặt trong migration để server không phụ thuộc vào việc chạy seed thủ công.

## 4.5. Bảng đối chiếu yêu cầu và kết quả

| Yêu cầu | Kết quả thực hiện | Mức độ |
|---|---|---|
| Phân quyền customer/vendor/admin | JWT, RBAC, ownership service checks, role-aware UI | Hoàn thành |
| Shop onboarding và admin review | Pending/approve/reject/suspend, audit/reason | Hoàn thành |
| Catalog đa nhà bán | Category, product CRUD, public visibility, shop storefront | Hoàn thành |
| Quản lý tồn kho | Inventory, ledger, reserve/release/sold, concurrency checks | Hoàn thành |
| Giỏ hàng và checkout | Selective cart, quote, Serializable commit, idempotency | Hoàn thành |
| Tách đơn theo shop | Parent order + shop orders + snapshots | Hoàn thành |
| Coupon | Global/shop campaign, limit, immutable used terms | Hoàn thành |
| Payment | COD, bank transfer, SePay hosted checkout/IPN/reconcile | Hoàn thành ở mức demo |
| Refund | Offline COD và callback-based bank transfer state machine | Hoàn thành một phần provider-neutral |
| Review | Delivered item eligibility, one review/order item | Hoàn thành |
| Notification | Transactional outbox, inbox/read states | Hoàn thành |
| Chat và AI | Customer-shop chat, realtime/polling, DeepSeek catalog grounding | Hoàn thành ở mức single-replica |
| Wishlist/recommendation | Persistent wishlist, interaction-based heuristic | Hoàn thành |
| Kiểm thử/CI/runbook | Unit, integration, E2E, Docker, CI, runbook | Hoàn thành |

\newpage

# 5. KIỂM THỬ, TRIỂN KHAI VÀ VẬN HÀNH

## 5.1. Các lớp kiểm thử

Để tránh phụ thuộc hoàn toàn vào manual test, dự án sử dụng nhiều lớp kiểm thử. Unit test chạy nhanh và tập trung vào hàm thuần hoặc state helper. Integration test xác nhận interaction với database thật, nhất là nơi transaction và unique constraint quyết định correctness. E2E test mô phỏng HTTP request qua Nest app, phù hợp kiểm tra JWT, cookie, DTO validation, guard, webhook raw body và format response.

Ví dụ, unit test không thể chứng minh hai checkout cùng lúc không oversell vì kết quả phụ thuộc transaction isolation và query condition ở PostgreSQL. Do đó, dự án dùng integration test với hai request cạnh tranh thực sự. Tương tự, webhook HMAC cần HTTP test để chắc middleware raw body và header parsing hoạt động đúng, không chỉ test service bằng object mock.

## 5.2. Các ca kiểm thử nghiệp vụ tiêu biểu

### 5.2.1. Checkout cạnh tranh

Kịch bản chuẩn bị một product có stock nhỏ và hai customer cùng checkout quantity vượt tổng available. Kết quả mong đợi là chỉ một transaction commit; transaction còn lại fail rõ ràng. Sau test, inventory không âm và ledger chỉ có số reserve tương ứng với order thành công. Kịch bản này chứng minh conditional update và Serializable retry đang bảo vệ business invariant.

### 5.2.2. Checkout idempotency

Customer gửi cùng idempotency key/payload hai lần do refresh trang hoặc timeout. Kết quả lần hai trả cùng parent order, không tạo order/payment/coupon usage/reservation mới. Nếu cùng key nhưng thay coupon, address, payment method hoặc selected cart items, hệ thống trả conflict để tránh hiểu sai ý định.

### 5.2.3. Payment webhook

Test kiểm tra webhook có secret sai, timestamp không hợp lệ hoặc payload modified không thể làm payment đổi status. Event hợp lệ amount đúng đi từ `UNPAID` qua `AUTHORIZED` đến `PAID` và tạo history. Replay chính xác trả duplicate thành công; reuse event ID với body khác bị conflict. Với SePay, E2E dùng payload `ORDER_PAID`, customer/agreement nullable, order captured và transaction approved.

### 5.2.4. Coupon và refund

Coupon test kiểm tra giá trị fixed/percentage, scope, min order, limit tổng, limit theo user và cạnh tranh checkout. Refund test kiểm tra không hoàn quá amount, COD cần admin xác nhận offline, bank transfer pending chờ webhook, và hai request refund song song không thể vượt remaining refundable.

### 5.2.5. Frontend state

Web test kiểm tra memory token, refresh deduplication, CSP builder, wishlist/cart indicator, selection cart, slug encoder, vendor product form, recommendation helper và navigation theo role. Đây là các phần dễ bị regression khi sửa UI nhưng không cần khởi chạy browser đầy đủ để phát hiện.

## 5.3. Triển khai server

Quy trình deployment demo gồm các bước: clone/pull repository trên server, tạo `.env.prod`, build Docker image API/Web, chạy migration, khởi động service bằng Docker Compose và cấu hình Nginx reverse proxy. API chỉ expose local loopback port, Nginx nhận HTTPS từ Internet. `TRUST_PROXY_HOPS` được cấu hình để rate limiter đọc đúng client IP qua proxy.

Trong `.env.prod`, các secret PostgreSQL, Redis, JWT, SePay và DeepSeek không được commit. Các biến public như `FRONTEND_URL` và `NEXT_PUBLIC_API_URL` dùng domain HTTPS. Sau mỗi thay đổi biến môi trường, API container phải được recreate; chỉ sửa file `.env.prod` nhưng không recreate container sẽ không thay đổi process đang chạy.

Đối với payment, IPN URL phải là endpoint HTTPS công khai `/api/payments/webhooks/sepay`. Khi gặp discrepancy “SePay hiển thị success nhưng order unpaid”, quy trình điều tra ưu tiên Nhật ký IPN của provider, response code endpoint, log API theo request ID, payment webhook event table và trạng thái payment. Không được tự cập nhật database thành `PAID` chỉ để bỏ qua lỗi, vì điều đó phá audit và không xác thực amount/provider reference.

## 5.4. Quan sát và xử lý sự cố

API tạo `x-request-id` cho request và đưa ID này vào structured error/log. Khi nhận lỗi từ khách hàng hoặc provider, request ID giúp tìm đúng dòng log. Health endpoint tách liveness và readiness: liveness xác nhận process chạy, readiness kiểm tra database/Redis phù hợp với policy fail-open/fail-closed.

Rate limit dùng Redis fixed-window với Lua script để nhiều API instances chia sẻ cùng quota. Khi Redis fail và policy closed, readiness không đạt và API trả 503 thay vì im lặng bỏ bảo vệ. Với policy open, API vẫn hoạt động nhưng có header báo degraded. Đây là một ví dụ về việc biến trade-off availability/security thành cấu hình rõ ràng.

Backup/restore drill dùng database target tách biệt, kiểm tra migration và số business rows sau restore rồi xóa database tạm. Load smoke giới hạn số request/concurrency để phát hiện lỗi rõ ràng mà không làm ảnh hưởng môi trường demo.

## 5.5. Bài học từ sự cố thực tế

Sự cố SePay IPN trả `400` là bài học quan trọng. Ban đầu, config URL/secret đúng nhưng payment vẫn unpaid. Nhật ký IPN hiển thị response `property agreement should not exist`. Nguyên nhân không phải mạng hay Nginx, mà là DTO validation chặt chẽ không chấp nhận field `agreement` nullable trong payload thật. Cách khắc phục là bổ sung field cụ thể và mở rộng E2E fixture. Không chọn giải pháp tắt `forbidNonWhitelisted` vì điều đó làm giảm khả năng phát hiện payload bất thường cho mọi API.

Sự cố này củng cố quy trình debug: bắt đầu từ evidence provider, đối chiếu response body và request ID, xác định lớp nào reject request, viết regression test, triển khai bản vá rồi retry event idempotent. Đây là cách xử lý có thể áp dụng cho mọi tích hợp webhook bên ngoài.

\newpage

# 6. TỰ ĐÁNH GIÁ KẾT QUẢ THỰC TẬP

## 6.1. Những kết quả đạt được

### 6.1.1. Kiến thức chuyên môn

Qua dự án, em củng cố được cách thiết kế backend NestJS theo module nghiệp vụ. Trước thực tập, em thường tập trung vào CRUD và controller. Trong dự án này, em hiểu rõ hơn controller chỉ nên nhận DTO và gọi service, còn service là nơi thực hiện authorization theo ownership, transaction và invariant. Em cũng hiểu Prisma không chỉ là công cụ query mà cần được kết hợp với isolation level, unique constraint và conditional update khi xử lý concurrency.

Em có thêm kinh nghiệm với Next.js App Router, phân tách server/client boundary, frontend route protection, state synchronization giữa trang và header badge, xử lý form async, loading/error states và UX theo role. Việc xây dựng ba workspace giúp em học cách thiết kế UI không chỉ theo component mà theo workflow của từng actor.

Về dữ liệu, em nắm rõ hơn lý do dùng Decimal cho tiền, snapshot order item, append-only history, ledger cho tồn kho và event table cho webhook/outbox. Các khái niệm này có giá trị thực tế cao vì chúng giải quyết câu hỏi “làm sao giải thích dữ liệu đã thay đổi như thế nào” thay vì chỉ lưu trạng thái cuối.

### 6.1.2. Kỹ năng giải quyết vấn đề

Em đã gặp và xử lý các lỗi không chỉ nằm trong source code mà còn ở integration và deployment: product active nhưng không public do điều kiện shop/stock; search clear không reset list do state submitted query; map search reload do nested form; product slug bị double-encode; UI card bị lỗi aspect ratio; order và cart thiếu canonical detail link; chat gửi sai với Vietnamese IME; payment success nhưng order unpaid do IPN DTO mismatch.

Qua các lỗi này, em rèn luyện cách không suy đoán sớm. Em học cách tìm evidence từ API response, log, database state, provider IPN log, test case và code path. Ví dụ SePay, thay vì tin rằng chỉ cần đúng redirect success URL là đủ, em đối chiếu log IPN `400`, cấu hình ValidationPipe và DTO để tìm nguyên nhân thực sự.

### 6.1.3. Kỹ năng kiểm thử và chất lượng

Em nhận thức rõ hơn rằng “chạy được trên máy” không đồng nghĩa “đúng”. Luồng checkout cần integration test; payment webhook cần E2E test; UI state nhỏ cần unit test. Việc viết test sau sự cố SePay giúp em thấy giá trị của regression test: lỗi provider payload tương tự sẽ được phát hiện trong CI thay vì sau khi deploy.

Em cũng có thói quen chạy lint, test và build trước khi commit; review diff để tránh stage file môi trường hoặc file không liên quan; cập nhật handbook/project context sau thay đổi. Đây là nền tảng quan trọng để làm việc trong team.

### 6.1.4. Kỹ năng vận hành và bảo mật

Em hiểu các bước cơ bản để triển khai ứng dụng containerized: build image, tạo env production, migration, recreate service, cấu hình Nginx, HTTPS/domain, health check và logs. Em cũng hiểu rằng secret không được đưa vào frontend hoặc commit, environment file thay đổi cần recreate container và API public phải được bảo vệ bằng rate limit/CSP/security headers.

Về payment, em rút ra nguyên tắc không tin browser redirect đối với state tiền. Chỉ callback đã xác thực hoặc server-to-server reconciliation có thể đánh dấu payment paid. Đây là nguyên tắc có thể áp dụng cho nhiều payment provider khác.

## 6.2. Điểm mạnh trong quá trình thực tập

Điểm mạnh đầu tiên là khả năng theo đuổi một bài toán xuyên suốt. Dự án không dừng ở trang catalog mà được mở rộng đến checkout, inventory, payment, notification, admin và deployment. Điều này yêu cầu giữ nhất quán domain model khi thêm chức năng mới.

Điểm mạnh thứ hai là ưu tiên business correctness ở các khu vực rủi ro. Em không chọn cách update stock trực tiếp hay chuyển payment sang paid chỉ từ frontend. Các quy tắc inventory ledger, transaction, state transition, idempotency và audit được đặt trong backend service và database.

Điểm mạnh thứ ba là chủ động cải thiện trải nghiệm sau khi có phản hồi. Ví dụ giao diện ban đầu chưa phân biệt role rõ, product card thiếu dữ liệu, form vendor thiếu field, checkout trộn với cart, UI dropdown chưa phù hợp. Những feedback này được chuyển thành thay đổi cụ thể thay vì chỉ chỉnh CSS bề mặt.

## 6.3. Hạn chế và điểm cần cải thiện

Thứ nhất, phạm vi dự án tương đối lớn nên một số phần triển khai ở mức demo/operational baseline, chưa đủ cho production scale. Chat realtime hiện phù hợp single API replica; cần Redis adapter hoặc managed realtime service nếu scale ngang. Recommendation là heuristic minh bạch nhưng chưa có A/B testing, telemetry conversion hoặc machine learning pipeline.

Thứ hai, payment integration đã có IPN/reconciliation nhưng automated outbound refund với SePay chưa được triển khai vì cần provider contract rõ ràng. Shipping vẫn là phí fixed theo shop, chưa tích hợp carrier, ETA hoặc tracking. Đây là những giới hạn cần được mô tả trung thực trong báo cáo.

Thứ ba, dữ liệu demo product là snapshot để kiểm thử, không phải feed đồng bộ giá/tồn kho. Nếu dùng public lâu dài, cần có nguồn dữ liệu được ủy quyền, ảnh lưu trên storage do hệ thống sở hữu và quy trình cập nhật dữ liệu.

Thứ tư, em cần tiếp tục rèn kỹ năng ước lượng effort và kiểm soát scope. Một số tính năng mở rộng như chat/AI/recommendation tạo thêm giá trị demo nhưng cũng tăng thời gian test và vận hành. Trong dự án thực tế, cần đánh giá ROI, risk và acceptance criteria trước khi nhận thêm scope.

## 6.4. Kế hoạch cải thiện cá nhân

Trong thời gian tới, em dự định đào sâu hơn về database performance, query analysis, index design, observability và cloud deployment. Em muốn thực hành triển khai CI/CD với staging environment, secret manager, managed database/Redis và monitoring dashboard.

Về backend, em cần học thêm về distributed transaction patterns, message broker, saga/outbox ở quy mô lớn, contract testing với provider bên ngoài và security review. Về frontend, em muốn cải thiện khả năng accessibility, visual regression test, performance profiling và thiết kế component system nhất quán.

Về kỹ năng mềm, em cần chủ động giao tiếp tiến độ theo rủi ro, làm rõ yêu cầu acceptance ngay từ đầu và ghi nhận quyết định kỹ thuật bằng tài liệu ngắn gọn. Đây là những yếu tố giúp giảm rework và tạo niềm tin trong team.

\newpage

# 7. KẾT LUẬN VÀ ĐỊNH HƯỚNG PHÁT TRIỂN

## 7.1. Kết luận

Intern Market đã đáp ứng mục tiêu chính của kỳ thực tập: xây dựng được một nền tảng thương mại điện tử đa nhà bán có luồng nghiệp vụ end-to-end và có các cơ chế bảo vệ correctness ở những domain quan trọng. Hệ thống hỗ trợ customer, vendor, admin; quản lý shop/product/inventory; selective cart/checkout; order splitting; coupon; review; notification; wishlist; recommendation; chat/AI; payment/SePay; và công cụ vận hành cơ bản.

Giá trị quan trọng nhất của đề tài không chỉ là số lượng màn hình hay endpoint, mà là các quyết định kỹ thuật nhằm bảo vệ dữ liệu: checkout transaction, inventory ledger, order snapshots, payment/fulfillment separation, idempotency, signed webhook, audit history và role/ownership checks. Những thành phần này giúp hệ thống có thể giải thích hành vi, test được và tiếp tục mở rộng có kiểm soát.

Quá trình thực tập cũng giúp em chuyển từ tư duy “hoàn thành chức năng” sang tư duy “hoàn thành luồng nghiệp vụ có kiểm chứng”. Mỗi thay đổi đều cần xem xét dữ liệu cũ, quyền truy cập, transaction, UI state, test, tài liệu và deployment. Đây là nền tảng quan trọng để em tiếp tục phát triển trong lĩnh vực phần mềm.

## 7.2. Định hướng phát triển

Các hướng phát triển ưu tiên trong tương lai gồm:

- Tích hợp shipping provider để tính phí, thời gian giao hàng và tracking thực.
- Hoàn thiện payment provider contract cho refund tự động hoặc quy trình refund có đối soát rõ ràng.
- Tách chat/realtime thành hạ tầng scale nhiều replica bằng Redis adapter hoặc managed service.
- Bổ sung object storage/CDN cho ảnh product và quy trình kiểm duyệt nội dung upload.
- Tích hợp search engine chuyên dụng khi catalog lớn hơn và cần full-text/facet hiệu năng cao.
- Thu thập metrics recommendation, xây A/B test và cân nhắc mô hình ML/embedding khi có dữ liệu đủ lớn và privacy policy rõ ràng.
- Bổ sung observability dashboard, alerting, tracing, managed backup/PITR và security scanning.
- Hoàn thiện accessibility, đa ngôn ngữ và mobile-first UX.

\newpage

# 8. PHỤ LỤC

## Phụ lục A. Luồng checkout rút gọn

```text
Customer chọn CartItem
        |
        v
POST /checkout/quote
        |
        +--> kiểm tra product/shop/inventory/coupon
        +--> group theo shop, tính subtotal/discount/shipping/total
        |
        v
POST /checkout/commit (idempotency key)
        |
        +--> Serializable transaction
        |      reserve inventory
        |      tạo ParentOrder + ShopOrder + OrderItem snapshot
        |      tạo Payment + CouponUsage
        |      xóa đúng CartItem đã chọn
        |      enqueue notification
        |
        v
Customer theo dõi ParentOrder; Vendor xử lý ShopOrder
```

## Phụ lục B. Luồng thanh toán SePay rút gọn

```text
Checkout commit tạo Payment(method=SEPAY, status=UNPAID)
        |
        v
Backend tạo hosted checkout form có chữ ký
        |
        v
Customer thanh toán tại SePay
        |
        +--> SePay POST IPN đến /api/payments/webhooks/sepay
        |      kiểm tra X-Secret-Key, invoice, VND, amount,
        |      CAPTURED, APPROVED, provider reference, event idempotency
        |
        +--> Browser return về /payments/sepay/return
               Web gọi reconcile server-to-server; chỉ hiển thị kết quả

Payment chỉ PAID khi backend có bằng chứng hợp lệ từ provider.
```

## Phụ lục C. Một số lệnh phát triển thường dùng

```bash
# Cài dependencies
npm install

# Khởi động hạ tầng local
docker compose up -d

# Prisma và dữ liệu demo
npm run prisma:generate -w @intern-project/api
npm run prisma:migrate -w @intern-project/api
npm run prisma:seed -w @intern-project/api
npm run seed:demo-catalog

# Chạy ứng dụng
npm run dev

# Kiểm tra chất lượng
npm run lint
npm run test
npm run build
```

## Phụ lục D. Checklist demo nghiệp vụ

1. Đăng nhập customer, vendor và admin bằng các tài khoản demo.
2. Customer tạo shop request; admin approve; owner có thể vào vendor workspace.
3. Vendor tạo product có mô tả, ảnh, attributes và stock; active product xuất hiện public nếu shop approved/còn hàng.
4. Customer thêm product vào wishlist/cart; header badge cập nhật.
5. Customer chọn item trong cart, sang checkout, chọn địa chỉ và coupon `WELCOME2K`.
6. Checkout tạo parent order và shop orders; vendor chuyển order theo trạng thái hợp lệ.
7. Customer review product sau delivered.
8. Customer mở chat với shop; vendor trả lời; bật AI nếu đã cấu hình DeepSeek key.
9. Customer chọn SePay; kiểm tra return page và Nhật ký IPN; payment chỉ chuyển paid sau callback hợp lệ.
10. Admin xem user/shop/coupon/payment/refund và audit liên quan.

## Phụ lục E. Danh sách tài liệu tham khảo nội bộ

- `docs/roadmap.md`: roadmap và phase phát triển ban đầu.
- `docs/business-rules.md`: quy tắc nghiệp vụ và status transitions.
- `docs/codebase-handbook.md`: giải thích kiến trúc, module, flow code, API và debug.
- `docs/production-runbook.md`: cấu hình, release, health check, backup, rollback và incident response.
- `docs/run-guide.md`: hướng dẫn chạy local và seed dữ liệu demo.
- `docs/demo-vendor-accounts.docx`: tài khoản vendor demo và phân bổ catalog.

---

**Xác nhận nội dung:** Báo cáo này mô tả trạng thái dự án tại thời điểm hoàn thiện bản báo cáo. Các thông tin nhạy cảm như password, JWT secret, database credential, DeepSeek key và SePay key không được đưa vào báo cáo hoặc phụ lục.
