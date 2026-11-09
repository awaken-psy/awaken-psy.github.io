---
title: lecture5 Real-time Environment Mapping 1
publish: true
updated: 2026-10-26T11:21:01.039Z
---

1. SDF
	- usage1：ray matching(sphere tracing)
		- sdf的值是一个安全距离
		- 多物体的场景的sdf，在每个点取所有物体的sdf的最小值
	- usage2：Distance Field Soft Shadows
		- shading point向光源发射光线，在这条光路上用 SDF 去测量“光线离障碍物的距离”，转化为一个安全角度
		- 用最小的安全角度来代表visibility![1052](<Attachments/Pasted image 20260807140448.png>)
		- 角度的计算，使用一个参数k来调节阴影的软硬（极大时为硬阴影）![868](<Attachments/Pasted image 20260807141657.png>)
2. Image-Based Lighting
	- 思路：将brdf和入射光拆分，分别去做预计算，shading时仅查表![852](<Attachments/Pasted image 20260807161558.png>)
	-  拆分依据：lecture3                                                                  ![858](<Attachments/Pasted image 20260807161716.png>)
		- diffuse：brdf光滑，满足b
		- 光滑glossy：support小，满足c
		- 粗糙glossy：不能直接用，但在对入射光使用不同大小的滤波核filter之后（生成 Mipmap 链），光滑可用，满足a
	- part1：入射光项
		- 用不同大小的卷积核做fliter，形成多级mipmap，查表时再在层间做三线性插值![665](<Attachments/Pasted image 20260807181625.png>)
		- 原本要加镜面反射的这个方向的周围一束采样，现在直接根据采样的范围大小选择不同层级的mipmap，在镜面反射方向查表得到预计算好的均值![](<Attachments/Pasted image 20260807181932.png>)
	- part2：brdf项（以microfacet BRDF为例）
		![567](<Attachments/Pasted image 20260807182153.png>)
		- 注意到brdf的参数为以下三个
    	  ![](<Attachments/Pasted image 20260807182235.png>)
	    - 把R0提出来，剩下的存入二维纹理![816](<Attachments/Pasted image 20260807214251.png>)







sdf,optimal transport,几何上的blending,