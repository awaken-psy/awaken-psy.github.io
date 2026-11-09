---
title: lecture6 Real-time Environment Mapping 2
publish: true
updated: 2026-10-26T11:21:01.052Z
---

1. Shadow form Environment Lighting
	- why so difficult
		- 光源太多，每一个光源需要生成一个shadowmap
		- 同一个shading point，在不同的光源的照射下的visibility截然不同
	- Industrial solution：Generate one (or a little bit more) shadows from the brightest light sources
	- related research：
		- Imperfect shadow maps
		- Light cuts
		- RTRT (might be the ultimate solution)
		- Precomputed radiance transfer
2. basic knowledge
	- product integral
		- 对于任意的product integral(两个函数先乘积在积分),我们将其认为是做了一个卷积操作,理解为spatial域上的两个信号f(x)和g(x)进行一个卷积,等于在频域上让两个信号相乘,如果两个信号有一个信号是低频的,那么频域上相乘后得到的结果也是低频的,最终相乘在积分的结果也是低频的,可以总结为：**积分之后的频率取决于积分前最低的频率**![1187](<Attachments/Pasted image 20260808133811.png>)
	- Basis Functions
		- 把一个函数可以描绘成其他函数的线性组合,如f(x)可以描绘成一系列的Bi函数乘以各自对应的系数最终再相加在一起,这一系列的函数Bi就是基函数
	- Spherical Harmonics
		- SH是一系列基函数,系列中的每个函数都是2维函数,并且每个二维函数都是定义在球面上的，可以理解为是对方向的函数。
		- 下图是对SH的可视化，与一维的傅里叶一样,SH也存在不同频率的函数，但不同频率的函数个数也不同,频率越高所含有的基函数越多。
		- 图中的颜色表示的是值的大小,偏白绝对值大,偏黑绝对值小，蓝色表示正,黄色表示负![1134](<Attachments/Pasted image 20260808134749.png>)
		- 投影到某个维度来确定系数（因为基函数是正交的）![1422](<Attachments/Pasted image 20260808134904.png>)
		- 环境光照就是一个球面函数,我们可以把它投影到任何一个SH basis上,可以投影很多阶,但是只需要取前三阶的SH去恢复环境光就可以恢复出最低频的细节
		- sh函数是可旋转的：旋转一个基函数之后，得到的函数就不再是一个基函数(因为基函数有严格的朝向等限制)，但是旋转球谐函数等价于同阶基函数的线性组合。
3. 使用Spherical Harmonics
	- Prefiltering + single query = no filtering + multiple queries
	- diffuse BRDF类似于一个低通滤波器，使用一些低频信息就可以恢复出原始内容。在本文之前的内容中曾说过：“**积分之后的频率取决于积分前最低的频率**”，无论光照项是多么复杂，我们都希望得到的是其与BRDF之积的积分，所以可以使用比较低频的基函数去描述灯光。diffuse的物体时使用前3阶的球谐基函数就可以基本重建出正确率99%的结果。![1004](<Attachments/Pasted image 20260808141825.png>)![689](<Attachments/Pasted image 20260808142329.png>)
4. PRT(Precomputed Radiance Transfer)![952](<Attachments/Pasted image 20260808153412.png>)![540](<Attachments/Pasted image 20260808155858.png>)。
	- 使用前提：
		-  **场景几何完全静止**（物体不能动、不能变形）。
		- **材质是漫反射（Diffuse）**（或者极其粗糙，与视角相关性极弱）。
	    - **光照是低频的**（环境光必须柔和，不能有极锐利的点光源高光）。
	- 在diffuse的前提下，brdf为常数，再将光照拆解为基函数的线性组合，计算转化为一次点乘![618](<Attachments/Pasted image 20260808153333.png>)
	- 对于场景中的每一个shadingpoint都会去做一个raytracing，然后存储O(N)，N为基函数的个数（L阶球谐的平方），这就是预计算的brdf。因为prt为静态+漫反射，所以可以直接代数求闭式解。![699](<Attachments/Pasted image 20260808155438.png>)
	- 注意在raytracing的过程中，第一弹为可以顺便算visibility
5. glossy的情况
	- brdf从原来的与观察方向无关变为了有关，复杂度从O(N)上升到O(N2)，4维的brdf通过矩阵存储从观察方向（2维）到光源方向（2维）的值![709](<Attachments/Pasted image 20260808172420.png>)