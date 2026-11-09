---
title: lec13 Linking
publish: true
updated: 2026-11-09T02:17:02.698Z
---

## 1.链接

### 1.1 静态链接流程（Static Linking）
![第4页编译与静态链接流程|702](Attachments/lec13-linking/page-04.png)

> 通过编译器驱动程序翻译和链接程序。

~~~sh
gcc -Og -o prog main.c sum.c
./prog
~~~

图中 main.c、sum.c 分别经过预处理器 cpp、编译器 cc1、汇编器 as，形成 main.o、sum.o。链接器 ld 再组合这些可重定位目标文件，形成 prog。

| 阶段  | 输入      | 主要输出            |
| --- | ------- | --------------- |
| 预处理 | .c 与头文件 | 展开宏和包含关系后的 C 源码 |
| 编译  | C 源码    | 汇编代码            |
| 汇编  | 汇编代码    | .o 目标文件         |
| 链接  | .o 与所需库 | 可执行文件           |

可以把命令拆成可观察的步骤。

~~~sh
gcc -Og -c main.c -o main.o
gcc -Og -c sum.c -o sum.o
gcc -o prog main.o sum.o
~~~

这里 main.o、sum.o 的代码会合入 prog。系统启动代码和 C 运行库如何参与链接，由编译器驱动及选项决定。

## 第 5 页｜Why Linkers?——模块化

> 第一个原因是模块化。
>
> 程序可以写成许多较小的源文件。
>
> 常用函数可以组织成库，例如数学库和标准 C 库。

各文件可以分别维护接口和实现。调用方通过声明使用功能，实现方可以在单独的源文件中提供定义。

本例 main.c 负责组织程序，sum.c 负责数组求和。链接器建立它们之间的调用关系。

## 第 6 页｜Why Linkers?——时间与空间效率

> 时间效率来自分离编译。修改一个源文件后，重新编译该文件，再重新链接。
>
> 空间效率来自库。公共函数集中打包，使用方选取所需内容。

在依赖关系允许的情况下，修改 sum.c 后可以复用已有 main.o。

~~~sh
gcc -Og -c sum.c -o sum.o
gcc -o prog main.o sum.o
~~~

头文件或编译配置改变时，构建系统还需要据依赖关系重新编译相关文件。

静态库的基本抽取单位是其中的目标文件成员。一个成员中可能含多个函数，按成员抽取可以把这些内容一起带入可执行文件。更细粒度删除未使用节等优化，取决于额外编译和链接选项。

## 第 7 页｜Symbol Resolution——符号解析

> 程序会定义和引用符号，例如函数与全局变量。
>
> 汇编器把符号定义信息写入目标文件的符号表。
>
> 符号表可以看作结构体数组，表项包含名字、大小、位置等信息。
>
> 链接器把每个需要解析的符号引用，关联到相应定义。

| 代码 | 符号作用 |
|---|---|
| void swap(void) { ... } | 定义函数符号 swap |
| swap(); | 引用函数符号 swap |
| int *xp = &x; | 定义 xp，并引用 x |

符号解析回答“这个名字指向哪一份定义”。例如 main.o 对 sum 的引用，最终关联到 sum.o 中的函数定义。

可以用 nm 查看目标文件中的符号。

~~~sh
nm main.o
nm sum.o
~~~

典型显示中，T 表示代码节中的全局符号，D 表示已分配的数据符号，U 表示当前文件尚未定义、需要从其他文件解析的符号。

## 第 8 页｜Relocation——重定位

> 合并各目标文件分散的代码节与数据节。
>
> 把符号在各 .o 中的相对位置安排到最终布局中。
>
> 更新涉及这些符号的引用，使其使用正确位置。

符号解析确定调用的是哪一个 sum，重定位负责让机器指令能够到达那个位置。

每个 .o 可以有自己的 .text、.data 等节。链接器为输出文件安排各部分布局，然后修补地址、位移或其他与位置有关的字段。

本讲固定地址的例子按传统非 PIE 可执行文件展示。使用位置无关可执行文件时，装载阶段还会结合加载基址完成相应处理。

## 第 9 页｜Three Kinds of Object Files——三类目标文件

| 类型 | 原文翻译 | 在流程中的用途 |
|---|---|---|
| 可重定位目标文件 .o | 代码和数据可与其他目标文件组合 | 作为链接器输入 |
| 可执行目标文件 | 内容可由系统装载并开始执行 | 运行程序 |
| 共享目标文件 .so | 可以装载并在加载时或运行时动态链接 | 提供共享库 |

课件用 a.out 指代可执行文件。a.out 也是 GCC 在未指定输出名时常见的默认名称，本讲这些文件内部采用 ELF 格式。

Windows 体系中的动态链接库称为 DLL。下文的文件格式、命令和动态装载接口采用 Linux 的具体形式。

## 第 10 页｜ELF——可执行与可链接格式

> ELF 是目标文件使用的标准二进制格式。
>
> 它统一描述可重定位目标文件、可执行目标文件和共享目标文件。
>
> 这些文件可以统称为 ELF 二进制文件。

ELF 的英文全称为 Executable and Linkable Format。

ELF 文件头中的类型字段可以区分 ET_REL、ET_EXEC、ET_DYN 等形式。共享库通常采用 ET_DYN，现代 PIE 可执行文件也可以使用 ET_DYN。

~~~sh
readelf -h main.o
readelf -h prog
~~~

文件扩展名帮助识别用途，文件头则提供实际格式和类型信息。

## 第 11 页｜ELF Object File Format——文件头与主要节

![第11页ELF文件结构](Attachments/lec13-linking/page-11.png)

| 部分 | 原文含义 |
|---|---|
| ELF header | 字长、字节序、文件类型、机器类型等 |
| Segment header table | 描述装载段的地址、大小、对齐等属性 |
| .text | 机器代码 |
| .rodata | 只读数据，例如常量、字符串和某些跳转表 |
| .data | 通常保存具有非零初值的静态存储期对象 |
| .bss | 通常保存零初始化的静态存储期对象 |

课件将段头表画在可执行文件前部，后面各节保存代码、数据与链接辅助信息。

.bss 在文件中记录大小和组织信息，实际运行时提供相应的零初始化空间，节内容通常不需要在文件里保存一整片零字节。

原文把 BSS 展开为 Block Started by Symbol，并用 Better Save Space 帮助记忆。

文件作用与内存作用需要分别观察。例如 .bss 节有运行时大小，文件中保存的内容字节数却可以为零。全局变量与函数内 static 变量，都可能落入 .data 或 .bss。

## 第 12 页｜ELF Object File Format——符号、重定位与调试信息

![第12页ELF辅助节](Attachments/lec13-linking/page-12.png)

| 部分 | 原文翻译 |
|---|---|
| .symtab | 符号表，记录过程、静态存储对象及相关节信息 |
| .rel.text | .text 的重定位信息，指出需要修改的代码字段与修改方法 |
| .rel.data | 数据中的地址、指针等需要重定位的信息 |
| .debug | 使用 gcc -g 生成的符号调试信息 |
| Section header table | 各节的偏移、大小等信息 |

图中的 .rel.txt 应按 .rel.text 理解。当前 x86-64 工具链常见 .rela.text 等带显式加数的重定位节。

节和段提供不同视角。链接器按节组合代码与数据，装载器主要根据程序头表中的段描述来建立运行时映射。

~~~sh
readelf -S main.o
readelf -r main.o
readelf -l prog
~~~

.symtab 用于符号管理，调试节记录源码位置等信息。动态链接还会使用动态符号等专门信息。

## 第 13 页｜Linker Symbols——链接符号的范围

> 全局符号由某模块定义，可以被其他模块引用，例如具有外部链接的函数和文件作用域变量。
>
> 外部符号是本模块引用、定义在其他模块的全局符号。
>
> 局部链接符号在本模块内部使用，例如声明为 static 的文件作用域函数和变量。

| 对象 | 作用范围与处理方式 |
|---|---|
| 全局函数 sum | 可以供其他目标文件解析引用 |
| 文件作用域的 static helper | 在当前模块内部链接 |
| 文件作用域的 static counter | 在当前模块内部链接，并占静态存储空间 |
| 函数内的自动变量 val | 由编译器安排寄存器或栈位置 |

这里“局部链接符号”描述模块间链接范围，C 中“局部变量”描述名字的作用域。函数内 static 变量虽然作用域在函数内，也具有整个程序执行期间的存储期。

## 第 14 页｜Step 1: Symbol Resolution——解析 main 与 sum

![第14页符号定义与引用](Attachments/lec13-linking/page-14.png)

> main.c 定义全局数组 array，并引用 sum。
>
> sum.c 定义 sum。
>
> 编译器负责自动变量 val、i、s 的位置，链接器处理函数和静态存储对象的跨模块关系。

| 符号 | main.o 中的状态 | sum.o 中的状态 |
|---|---|---|
| main | 定义 | — |
| array | 定义，并在调用参数中引用 | — |
| sum | 外部引用 | 定义 |

程序成功链接后，main 对 sum 的调用绑定到 sum.o 中那一份定义。

val、i、s 的名字可以出现在调试信息中，寄存器分配和栈布局由编译器决定。

## 第 15 页｜Local Symbols——函数内 static 对象

![第15页函数内静态变量](Attachments/lec13-linking/page-15.png)

> 自动局部变量通常由寄存器或栈保存。
>
> 函数内 static 变量保存在 .bss 或 .data 等静态存储区。
>
> 编译器为不同定义分配独立空间，并在符号表中使用可区分的内部名字。

~~~c
int f(void)
{
    static int x = 0;
    return x;
}

int g(void)
{
    static int x = 1;
    return x;
}
~~~

f 中的 x 和 g 中的 x 是两个独立对象。内部符号名可能类似 x.0、x.1，具体形式由编译器决定。

原图右侧把两者都概括为分配在 .data。常见 GCC 输出会把零初始化的对象放在 .bss，把初值为 1 的对象放在 .data。

使用 -O0 编译并用 nm、readelf 观察，可以保留这个示例的存储布局，便于对照。

## 第 16 页｜Duplicate Symbol Definitions——同名定义与强弱规则

![第16页强弱符号原例](Attachments/lec13-linking/page-16.png)

> 课件把函数与显式初始化的全局变量称为强符号，把未显式初始化的全局变量称为弱符号。
>
> 示例中 int foo=5 与函数 p1、p2 是强定义，另一文件中的 int foo 按课件规则参与合并。

理解这一页，需要保留 2015 年 GCC 常见 -fcommon 行为的背景。文件作用域的 int foo; 在 C 中是暂定定义。

| 写法与编译方式 | 常见目标文件表示 |
|---|---|
| int foo = 5; | 已分配的全局数据符号，常见 nm 类型 D |
| int foo;，使用 -fcommon | COMMON 符号，常见 nm 类型 C |
| int foo;，使用 -fno-common | 分配到 .bss 的全局符号，常见 nm 类型 B |
| 显式 __attribute__((weak)) | ELF 的弱绑定，可用于对象或函数 |

COMMON 的绑定通常仍为 GLOBAL。课件这里用“弱”概括 COMMON 的历史合并行为，实际 ELF 弱绑定另有专门的 WEAK 类型。

GCC 10 起默认采用 -fno-common。本机 GCC 13.4 也采用这一默认行为，多个源文件各写 int foo; 通常会在链接时报重复定义。历史合并示例可以显式使用 -fcommon 观察。[GCC 10 移植说明](https://gcc.gnu.org/gcc-10/porting_to.html)

## 第 17 页｜Linker’s Symbol Rules——课件的符号选择规则

> 规则一，多个强定义引起链接错误。
>
> 规则二，强定义与可合并的弱定义同时出现时，选择强定义。
>
> 规则三，多个弱定义同时出现时，课件将结果概括为选取其中一个。
>
> 课件指出可以用 -fno-common 改变未初始化全局变量的处理。

规则一可以用两个文件都定义同名普通函数观察，链接器会报告 multiple definition。

规则二在历史 COMMON 模型中，可以让 int x=7; 提供实际定义，另一文件的 int x; 合并到它。

规则三的 COMMON 合并还涉及大小和对齐。不同类型同名对象带来的类型问题，需要由一致的源码声明来控制。

今天观察这组例子时，应记录编译选项。可以分别编译并查看符号。

~~~sh
gcc -O0 -fcommon -c p1.c p2.c
nm p1.o p2.o

gcc -O0 -fno-common -c p1.c p2.c
nm p1.o p2.o
~~~

规范的共享变量组织方式是由一个源文件提供定义，其他文件通过 extern 声明引用，下一页继续分析重复定义造成的现象。


## 第 18 页｜Linker Puzzles——重复定义练习

![第18页链接器练习](Attachments/lec13-linking/page-18.png)

下表保留课件的历史 COMMON 处理语境。图中的 p1、p2 表示普通函数定义。

| 第一文件 | 第二文件 | 课件描述的结果 |
|---|---|---|
| 定义函数 p1 | 再定义函数 p1 | 两个强函数定义引起链接错误 |
| int x; | int x; | 两个引用合并到同一个零初始化对象 |
| int x; int y; | double x; | 类型不一致，对 x 的写入可能破坏其他数据 |
| int x=7; int y=5; | double x; | 按 double 写入可能超过实际 int 对象的大小 |
| int x=7; | int x; | 合并到初值为 7 的对象 |

GCC 默认 -fno-common 时，后四组中的重复外部定义通常也会引起链接错误。显式采用 -fcommon 才便于观察本页的历史合并行为。

**同名变量的类型必须一致。**

在本讲平台中，int 通常占 4 B，double 占 8 B。若一处定义 x 为 int，另一处把同一存储位置按 double 操作，就可能发生错误解释或越界写入。

原图把某些情况写成“会覆盖 y”。具体是否覆盖 y，取决于大小、对齐、分配位置和编译结果。COMMON 的合并通常会考虑最大大小与对齐，类型不一致本身仍违反 C 对同一对象声明的一致性要求。

页脚还提出两个同名结构体由不同编译器、不同对齐规则编译的情形。结构体字段偏移也属于跨模块接口的一部分，名字相同不足以保证布局一致。

## 第 19 页｜Global Variables——组织全局变量

> 尽量减少全局变量。
>
> 需要使用时，可以在合适范围使用 static。
>
> 定义全局变量时给出初始化。
>
> 引用其他模块提供的全局变量时使用 extern。

| 目的 | 示例 |
|---|---|
| 一个源文件提供定义 | int counter = 0; |
| 头文件公开声明 | extern int counter; |
| 仅供当前源文件使用 | static int counter = 0; |

头文件中的 extern 声明让各使用方看到一致的类型。一个源文件承担定义与存储分配，其他源文件引用它。

初始化为 0 的定义具有明确的定义语义，常见编译结果仍可以放在 .bss。源码中的初始化语义与目标文件中选择哪个节，是两个需要分别观察的方面。

## 第 20 页｜Step 2: Relocation——把各文件放入最终布局

![第20页合并节并安排位置](Attachments/lec13-linking/page-20.png)

> 左侧是各个可重定位目标文件，右侧是链接后的可执行目标文件。
>
> 系统代码、main.o 和 sum.o 的代码合并到输出 .text，数据安排到输出数据区域，并保留相关符号与调试信息。

原图右侧函数写成 swap()，按左侧 main.o 与 sum.o 的示例，应理解为 sum()。

链接器先知道各节与符号需要多少空间，再安排它们在输出布局中的位置。随后，原来引用 array、sum 的位置就可以被修补。

符号解析确定引用对应哪一份定义，重定位进一步确定如何到达或表示这份定义的位置。

## 第 21 页｜Relocation Entries——重定位记录

![第21页main.o重定位记录](Attachments/lec13-linking/page-21.png)

> main.o 中，array 地址和 sum 调用位移仍有待链接器填入。
>
> objdump -r -d main.o 可以同时查看指令与重定位记录。

课件中关键部分为

~~~text
9:  bf 00 00 00 00       mov $0x0,%edi
a:  R_X86_64_32 array

e:  e8 00 00 00 00       callq ...
f:  R_X86_64_PC32 sum-0x4
~~~

偏移 9 处的指令有 1 字节操作码，后面从偏移 a 开始的 4 字节立即数字段需要写入 array 的地址。

偏移 e 处的 call 也有 1 字节操作码，偏移 f 开始的 4 字节字段保存相对位移。

| 记录 | 需要处理的内容 |
|---|---|
| R_X86_64_32 array | 按相应规则填入 array 地址 |
| R_X86_64_PC32 sum-0x4 | 根据 sum 最终位置计算 32 位 PC 相对位移 |

这些记录包含修补位置、目标符号和计算方式。占位字节与重定位记录要一起阅读。

对照本讲固定地址形式，可以用以下命令观察。

~~~sh
gcc -Og -fno-pie -c main.c -o main.o
gcc -Og -fno-pie -c sum.c -o sum.o
objdump -dr main.o
gcc -no-pie -o prog main.o sum.o
~~~

现代工具链对外部函数调用可能显示 R_X86_64_PLT32 等类型。输出的具体指令地址由编译器和链接布局决定，下面仍用课件地址演算。

## 第 22 页｜Relocated .text Section——修补后的代码

![第22页重定位结果](Attachments/lec13-linking/page-22.png)

课件中 main 位于 0x4004d0，array 位于 0x601018，sum 位于 0x4004e8。

~~~text
4004d9: bf 18 10 60 00   mov $0x601018,%edi
4004de: e8 05 00 00 00   callq 4004e8 <sum>
4004e3: ...              下一条指令
~~~

**array 地址按小端序写入。**

$$
0x00601018\longrightarrow18\ 10\ 60\ 00
$$

**call 的相对位移按下一条指令计算。**

$$
\text{位移}=0x4004e8-0x4004e3=5
$$

所以 call 的 4 字节位移字段为 05 00 00 00，执行时满足

$$
0x4004e3+5=0x4004e8
$$

也可以按 ELF 重定位公式计算

$$
\text{PC32写入值}=S+A-P
$$

S 为目标符号地址，A 为重定位加数，P 为待修补字段的起始地址。本例 P=0x4004df，A=-4，因此

$$
0x4004e8-4-0x4004df=5
$$

-4 将 4 字节位移字段的起点与下一条指令的地址联系起来。[x64 ELF 重定位公式](https://docs.oracle.com/cd/E36784_01/html/E36857/chapter7-2.html)

## 第 23 页｜Loading Executable Object Files——装载可执行文件

![第23页ELF装载到进程地址空间](Attachments/lec13-linking/page-23.png)

> 文件中包含 ELF 头、程序头表、代码与数据节，以及符号和调试相关节。
>
> 装载后，进程地址空间包含代码、数据、堆、共享库映射、用户栈以及受保护的内核区域。

| 图中区域 | 含义 |
|---|---|
| Read-only code segment | 示例中的 .init、.text、.rodata 等区域 |
| Read/write data segment | .data 与 .bss 等可写数据 |
| Run-time heap | malloc 等机制使用的运行时堆空间 |
| Memory-mapped region | 共享库等映射所在区域 |
| User stack | 用户栈，图中由 rsp 指向相关位置 |
| Kernel virtual memory | 用户态访问受到保护的内核虚拟地址区域 |

这张图描述进程的虚拟地址空间。内核根据程序头中的装载段建立映射，并为零初始化区域提供相应内容。

图中约 0x400000 的布局对应课件非 PIE 示例。栈、堆和共享库区域还涉及运行时创建与映射。

普通符号表和调试节主要供链接、调试工具使用。运行时需要映射哪些范围，由段属性与程序头等信息决定。

## 第 24 页｜Packaging Commonly Used Functions——打包公共函数

> 如何打包数学、I/O、内存管理、字符串处理等常用功能？
>
> 方案一，把所有函数放进一个源文件。使用方需要链接一个大目标文件，空间与构建成本较高。
>
> 方案二，每个函数单独一个源文件。使用方手工列出所需目标文件，更灵活，但管理负担较大。

本页的问题是同时获得统一管理与按需选取。下面的静态库把多个目标文件打成归档，并提供成员索引。

## 第 25 页｜Static Libraries——静态库

> 静态库是 .a 归档文件。
>
> 相关的可重定位目标文件与索引打包为一个文件。
>
> 链接器在归档里查找能解决当前外部引用的成员，并把需要的成员链接进程序。

可以把静态库理解成带索引的目标文件集合。例如 libvector.a 包含 addvec.o、multvec.o。

调用方需要 addvec 时，链接器可以抽取 addvec.o。抽取按归档成员进行，成员内部的代码和数据随之参与后续布局与重定位。

## 第 26 页｜Creating Static Libraries——创建静态库

![第26页ar归档流程](Attachments/lec13-linking/page-26.png)

> 分别编译 atoi.c、printf.c、random.c 等源文件，得到目标文件。
>
> 使用归档器 ar，把相关 .o 打包为 libc.a。
>
> 归档支持增量更新。某个成员改变后，可重新编译并替换其目标文件。

课件原命令形式为

~~~sh
ar rs libc.a atoi.o printf.o random.o
~~~

后面的自定义向量库使用

~~~sh
gcc -Og -c addvec.c multvec.c
ar rcs libvector.a addvec.o multvec.o
ar t libvector.a
~~~

r 表示插入或替换成员，c 用于创建归档，s 生成或更新符号索引，t 列出成员。

归档器负责打包，符号选择与最终地址修补仍由链接器完成。

## 第 27 页｜Commonly Used Libraries——常见静态库

> libc.a 是标准 C 库，课件版本约 4.6 MB，包含 1496 个目标文件。
>
> 功能包括 I/O、内存分配、信号处理、字符串、日期与时间、随机数和整数处理。
>
> libm.a 是数学库，课件版本约 2 MB，包含 444 个目标文件，提供 sin、cos、tan、log、exp、sqrt 等功能。

~~~sh
ar t libc.a
ar t libm.a
~~~

课件列出的成员例子包括 libc.a 中的 fprintf.o、fputc.o、fscanf.o，以及 libm.a 中的 e_acos.o、e_asin.o 等。

文件大小和成员数量属于当时库版本的统计。名字 libc、libm 描述库的功能，.a 描述其归档形式。

## 第 28 页｜Linking with Static Libraries——向量库示例

![第28页向量库示例](Attachments/lec13-linking/page-28.png)

main2.c 调用向量加法，打印结果。

~~~c
#include <stdio.h>
#include "vector.h"

int x[2] = {1, 2};
int y[2] = {3, 4};
int z[2];

int main(void)
{
    addvec(x, y, z, 2);
    printf("z = [%d %d]\n", z[0], z[1]);
    return 0;
}
~~~

vector.h 提供接口声明。

~~~c
#ifndef VECTOR_H
#define VECTOR_H

void addvec(int *x, int *y, int *z, int n);
void multvec(int *x, int *y, int *z, int n);

#endif
~~~

addvec.c 实现逐元素相加。

~~~c
void addvec(int *x, int *y, int *z, int n)
{
    for (int i = 0; i < n; i++)
        z[i] = x[i] + y[i];
}
~~~

multvec.c 实现逐元素相乘。

~~~c
void multvec(int *x, int *y, int *z, int n)
{
    for (int i = 0; i < n; i++)
        z[i] = x[i] * y[i];
}
~~~

调用 addvec 后，z 为 [4,6]。整理代码补充了头文件声明，并把原图的排版引号改为 C 字符串引号。

## 第 29 页｜Linking with Static Libraries——按需抽取成员

![第29页静态库成员抽取](Attachments/lec13-linking/page-29.png)

> main2.c 与 vector.h 编译得到 main2.o。
>
> addvec.o、multvec.o 打包进 libvector.a。
>
> 链接器从库中抽取 addvec.o，并结合程序所需的其他运行库成员形成可执行文件。

~~~sh
gcc -Og -c main2.c -o main2.o
gcc -static -o prog2c main2.o ./libvector.a
./prog2c
~~~

这里 -static 对应课件把系统 C 库也按静态形式加入的演示。程序输出 z = [4 6]。

main2.o 引用 addvec，归档中的 addvec.o 因此被抽取。multvec.o 在这个例子中没有被引用，可继续留在归档里。

图中名称 prog2c 的 c 用于提示本例在构建阶段完成这部分链接。

## 第 30 页｜Using Static Libraries——命令行顺序

> 链接器按照命令行顺序扫描 .o 和 .a，跟踪当前未解析引用。
>
> 扫描遇到提供定义的对象或归档成员时，尝试解决已有引用。
>
> 扫描结束仍有未解析引用，就报告错误。
>
> 库在命令行中的位置会影响结果。

课件用以下两种顺序对照。

~~~sh
gcc -L. libtest.o -lmine
gcc -L. -lmine libtest.o
~~~

后一种顺序在课件例子中产生 libfun 的 undefined reference。

向量库可以使用同样的对照。

~~~sh
gcc -o order_ok main2.o ./libvector.a
gcc -o order_bad ./libvector.a main2.o
~~~

第一条命令先读到 main2.o 的 addvec 引用，再从归档抽取 addvec.o。第二条读归档时尚未出现这个引用，之后出现的引用通常不会让先前归档自动重新扫描。

一个归档内部可以继续抽取解决新依赖的成员。多个静态库相互依赖时，GNU ld 还提供组扫描等机制。这里先掌握普通顺序下“引用方在前，提供定义的静态库在后”的组织方式。[GNU ld 命令选项](https://sourceware.org/binutils/docs/ld/Options.html)

## 第 31 页｜Shared Libraries——共享库

> 静态库可能让多个可执行文件重复包含相同库代码，运行映像也可能重复占用空间。
>
> 库的小修复需要使用方重新链接。
>
> 共享库提供包含代码和数据的目标文件，在装载或运行时动态加入应用。
>
> Linux 常用 .so，Windows 中称为 DLL。

共享库把可复用实现作为单独文件提供。兼容更新后，新启动的应用可以装载更新后的实现。

动态链接保留了运行时还需要完成的符号关联与重定位信息，下一页区分两种发生时间。

## 第 32 页｜Shared Libraries——装载时与运行时链接

> 装载时动态链接发生在程序被装载、开始执行时，Linux 动态链接器负责相关工作。
>
> 标准 C 库通常采用动态链接形式。
>
> 程序开始执行后，也可以通过 dlopen 接口进行运行时链接。
>
> 应用包括软件分发、高性能 Web 服务器与运行时库插桩。
>
> 共享库例程可以由多个进程共享。

装载时方式通常由可执行文件的依赖信息驱动。运行时方式由程序主动请求，例如按需要加载插件。

共享库的只读代码页可以供多个进程共享，各进程仍有自己的虚拟地址空间和可写状态。

## 第 33 页｜Dynamic Linking at Load-time——装载时动态链接

![第33页装载时动态链接](Attachments/lec13-linking/page-33.png)

> 先生成共享库和主程序。
>
> 主程序保存动态链接所需的符号、重定位及依赖信息。
>
> 装载时，动态链接器结合共享库代码与数据，完成相应处理。

整理命令显式使用 -fPIC 生成位置无关代码，并为本地库设置相对可执行文件目录的搜索路径。

~~~sh
gcc -fPIC -shared -o libvector.so addvec.c multvec.c
gcc -Og -o prog2l main2.c -L. -lvector -Wl,-rpath,'$ORIGIN'
./prog2l
~~~

-shared 生成共享目标文件，-L. 指定构建时的库搜索目录，-lvector 使用 vector 库，rpath 中的 $ORIGIN 对应程序文件所在目录。

图中 prog2l 的 l 提示 load-time。加载阶段建立库的映射并完成必要重定位，采用延迟绑定时，部分函数绑定可以推迟到真正调用时。


## 第 34 页｜Dynamic Linking at Run-time——运行时加载库

![第34页dlopen加载共享库](Attachments/lec13-linking/page-34.png)

> 程序包含 stdio.h、stdlib.h、dlfcn.h。
>
> 使用 dlopen 动态加载包含 addvec 的共享库。
>
> 加载失败时读取 dlerror，打印错误并结束程序。

课件中的核心调用为

~~~c
handle = dlopen("./libvector.so", RTLD_LAZY);
~~~

handle 是当前加载对象的句柄。RTLD_LAZY 允许部分函数调用的绑定延后到真正使用时进行。

后续使用函数指针调用库函数，类型写作

~~~c
void (*addvec)(int *, int *, int *, int);
~~~

它描述一个指针，指向返回 void、接受四个给定参数的函数。取得函数地址之后，可以通过该指针发起调用。

## 第 35 页｜Dynamic Linking at Run-time——查找、调用与释放句柄

![第35页dlsym与dlclose](Attachments/lec13-linking/page-35.png)

> 使用 dlsym 查找刚刚加载的 addvec。
>
> 检查错误后，通过函数指针调用它，打印向量结果。
>
> 最后调用 dlclose 释放库句柄。

下面把第 34–35 页整理成完整的 dll.c。dlsym 前先清除旧错误，dlclose 按非零返回值检查失败。

~~~c
#include <stdio.h>
#include <stdlib.h>
#include <dlfcn.h>

int x[2] = {1, 2};
int y[2] = {3, 4};
int z[2];

int main(void)
{
    void *handle = dlopen("./libvector.so", RTLD_LAZY);
    if (handle == NULL) {
        fprintf(stderr, "%s\n", dlerror());
        return EXIT_FAILURE;
    }

    dlerror();
    void (*addvec)(int *, int *, int *, int);
    addvec = (void (*)(int *, int *, int *, int))
        dlsym(handle, "addvec");

    const char *error = dlerror();
    if (error != NULL) {
        fprintf(stderr, "%s\n", error);
        dlclose(handle);
        return EXIT_FAILURE;
    }

    addvec(x, y, z, 2);
    printf("z = [%d %d]\n", z[0], z[1]);

    if (dlclose(handle) != 0) {
        fprintf(stderr, "%s\n", dlerror());
        return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
}
~~~

~~~sh
gcc -Og -o dll dll.c -ldl
./dll
~~~

程序输出 z = [4 6]。这里的函数指针转换采用 Linux/POSIX 的接口约定。

dlerror 在查找前清空旧状态，查找后读取本次状态。dlclose 释放句柄引用，是否卸载对象还取决于其他引用与加载器状态。[dlsym 接口](https://man7.org/linux/man-pages/man3/dlsym.3.html) [dlopen 与 dlclose 接口](https://man7.org/linux/man-pages/man3/dlopen.3.html)

## 第 36 页｜Linking Summary——链接发生的时间

> 链接使程序可以由多个目标文件构成。
>
> 链接可以发生在程序构建时、装载时或运行时。
>
> 理解链接有助于分析构建错误和程序行为。

| 时间 | 本讲例子 | 处理方式 |
|---|---|---|
| 构建阶段 | main.o 与 sum.o，自定义静态库 | 链接器组合目标内容并修补引用 |
| 装载阶段 | 主程序依赖 libvector.so | 动态链接器加载依赖并处理符号与重定位 |
| 运行阶段 | dlopen、dlsym | 程序主动选择库并取得函数地址 |

课件将构建阶段归入 compile time。该阶段内部还包括编译、汇编和最终链接等步骤。

## 2.库插桩案例研究

## 第 37 页｜Today——进入库插桩案例

> 链接。
>
> 库插桩案例研究。

目录将重点切换到第二部分。下面利用编译、链接与动态查找阶段的符号处理，把调用引向包装函数。

## 第 38 页｜Library Interpositioning——库插桩

> 库插桩是一种允许拦截函数调用的链接技术。
>
> 它可以发生在源代码编译时、可重定位文件链接时，以及装载或运行时。

包装函数接收原调用的参数，可以增加记录、检查等处理，再转交原实现。

实际可拦截范围取决于调用参与哪个解析阶段。编译期方法依赖宏覆盖调用点，链接期方法依赖需要解析的符号引用，动态方法依赖运行时符号查找。

## 第 39 页｜Interpositioning Applications——安全与调试

> 安全用途包括约束行为、构建沙箱和透明加密。
>
> 2014 年，Facebook 工程师通过插桩定位了 iPhone 应用中长期存在的文件损坏问题。
>
> 问题涉及 SPDY 网络栈写入错误位置，通过拦截 write、writev、pwrite 等 POSIX 写入函数进行定位。

原始工程文章说明了更具体的过程。网络连接关闭后，原文件描述符被数据库文件复用，SSL 层仍向旧描述符写入，数据因此进入数据库文件。

工程师拦截写入调用，检查其目标描述符，在捕获到错误写入时获得调用路径。这展示了在函数边界记录参数、定位真正调用来源的方法。iOS 案例使用 Fishhook 的符号重绑定机制。[Meta 工程原文](https://engineering.fb.com/2014/08/12/ios/debugging-file-corruption-on-ios/)

## 第 40 页｜Interpositioning Applications——监控与性能分析

> 统计函数调用次数。
>
> 记录调用位置和函数参数。
>
> 跟踪 malloc，为内存泄漏分析和地址轨迹生成提供信息。

记录分配地址、大小与释放事件，可以观察堆块的生命周期。把分配与释放配对，也能为哪些分配仍然存续提供线索。

这种记录围绕函数接口发生，适合在已有程序外围增加观测能力。

## 第 41 页｜Example Program——分配与释放跟踪

课件的 int.c 为

~~~c
#include <stdio.h>
#include <malloc.h>

int main(void)
{
    int *p = malloc(32);
    free(p);
    return 0;
}
~~~

> 目标是记录分配、释放的堆块地址与大小，同时保持程序原有调用行为。
>
> 分别通过编译期、链接期和装载／运行期插桩实现。

这个程序分配 32 B，再释放返回的指针。下面三种方式使用同一份 int.c，通过不同构建方式插入包装。

实验命令采用 -O0，并加 -fno-builtin 保留用于观察的外部分配与释放调用。

## 第 42 页｜Compile-time Interpositioning——编译期包装函数

![第42页编译期包装原例](Attachments/lec13-linking/page-42.png)

> 定义 mymalloc 与 myfree，调用真实分配、释放函数，并输出日志。
>
> COMPILETIME 条件编译段选择这组实现。

下面代码作为 mymalloc.c 的一个条件段。整理版用标准头文件 stdlib.h，size_t 采用 %zu，释放日志在 free 前记录。

~~~c
#ifdef COMPILETIME
#include <stdio.h>
#include <stdlib.h>

void *mymalloc(size_t size)
{
    void *ptr = malloc(size);
    printf("malloc(%zu) = %p\n", size, ptr);
    return ptr;
}

void myfree(void *ptr)
{
    printf("free(%p)\n", ptr);
    free(ptr);
}
#endif
~~~

mymalloc 接收原大小参数，把真实 malloc 的返回值交还调用方。myfree 记录调用参数后，再调用真实 free。

包装文件单独编译时使用系统分配函数的声明，后面的宏替换只应用到需要观测的调用方。

## 第 43 页｜Compile-time Interpositioning——宏替换与构建

![第43页编译期宏和命令](Attachments/lec13-linking/page-43.png)

> 自定义 malloc.h 将 malloc(size) 展开成 mymalloc(size)，将 free(ptr) 展开成 myfree(ptr)。
>
> -I. 使调用方优先搜索当前目录的头文件。

自定义 malloc.h 可以整理为

~~~c
#ifndef LOCAL_MALLOC_H
#define LOCAL_MALLOC_H
#include <stddef.h>

void *mymalloc(size_t size);
void myfree(void *ptr);

#define malloc(size) mymalloc((size))
#define free(ptr) myfree((ptr))

#endif
~~~

~~~sh
gcc -std=gnu11 -O0 -Wall -Wextra -DCOMPILETIME -c mymalloc.c -o mymalloc-c.o
gcc -std=gnu11 -O0 -Wall -Wextra -fno-builtin -I. -o intc int.c mymalloc-c.o
./intc
~~~

第一条编译包装实现，第二条让 int.c 包含当前目录的自定义 malloc.h。调用方源文件中的函数调用因此在预处理阶段变成 mymalloc、myfree。

输出会包含 malloc(32) 与相同指针的 free 记录。实际地址由本次运行的分配结果决定。

图中 make intc、make runc 是执行对应构建和运行命令的 Makefile 目标。

## 第 44 页｜Link-time Interpositioning——链接期包装函数

![第44页链接期包装原例](Attachments/lec13-linking/page-44.png)

> 定义 __wrap_malloc 和 __wrap_free 作为包装入口。
>
> 包装内部通过 __real_malloc、__real_free 调用原实现。
>
> LINKTIME 条件编译段选择这组实现。

下面代码是 mymalloc.c 的另一条件段。

~~~c
#ifdef LINKTIME
#include <stdio.h>
#include <stddef.h>

void *__real_malloc(size_t size);
void __real_free(void *ptr);

void *__wrap_malloc(size_t size)
{
    void *ptr = __real_malloc(size);
    printf("malloc(%zu) = %p\n", size, ptr);
    return ptr;
}

void __wrap_free(void *ptr)
{
    printf("free(%p)\n", ptr);
    __real_free(ptr);
}
#endif
~~~

这些名字与 GNU 链接器的 --wrap 规则配合使用。调用方目标文件仍带有对 malloc、free 的外部引用。

## 第 45 页｜Link-time Interpositioning——链接选项

![第45页链接期命令](Attachments/lec13-linking/page-45.png)

> -Wl 把参数传给链接器，逗号用于分隔这些参数。
>
> --wrap,malloc 让对 malloc 的引用解析到 __wrap_malloc，让对 __real_malloc 的引用解析到 malloc。

~~~sh
gcc -std=gnu11 -O0 -Wall -Wextra -DLINKTIME -c mymalloc.c -o mymalloc-l.o
gcc -std=gnu11 -O0 -Wall -Wextra -fno-builtin -c int.c -o int.o
gcc -Wl,--wrap,malloc -Wl,--wrap,free -o intl int.o mymalloc-l.o
./intl
~~~

| 原引用 | --wrap 处理后的目标 |
|---|---|
| malloc | __wrap_malloc |
| __real_malloc | malloc |
| free | __wrap_free |
| __real_free | free |

这些重写针对参与链接的未解析符号引用。原实现仍然可以由 __real 名字关联到，包装函数因此能继续转发调用。[GNU ld 的 --wrap 选项](https://sourceware.org/binutils/docs/ld/Options.html)

## 第 46 页｜Load/Run-time Interpositioning——运行时截获 malloc

![第46页运行时malloc包装原例](Attachments/lec13-linking/page-46.png)

> 定义一个同名 malloc 包装函数。
>
> 使用 dlsym(RTLD_NEXT, "malloc") 找到后继实现。
>
> 调用该实现完成分配，再记录大小与地址。

与前两种方法相比，这里直接导出名为 malloc 的函数。动态符号查找优先选中它之后，就进入包装代码。

RTLD_NEXT 从当前共享对象之后继续寻找同名实现。在本例中，最终取得 libc 分配器的地址，再通过函数指针调用。[RTLD_NEXT 的定义](https://man7.org/linux/man-pages/man3/dlsym.3.html)

原页在 malloc 包装内部调用 printf。stdio 的缓冲建立可能再次触发分配，形成递归进入包装函数的路径。第 48 页的可运行整理版用栈内缓冲与 write 输出日志，并复用已解析的函数指针。

## 第 47 页｜Load/Run-time Interpositioning——运行时截获 free

![第47页运行时free包装原例](Attachments/lec13-linking/page-47.png)

> 定义同名 free，使用 dlsym(RTLD_NEXT, "free") 找到后继释放函数。
>
> 参数为 NULL 时直接返回。
>
> 调用后继实现并记录地址。

free 的包装同样需要把调用转发给后继实现，维持原来的释放行为。

整理版在转发前记录地址，并让日志过程保存、恢复 errno。这样既能取得释放参数，也能减少日志对被观察调用状态的干扰。

## 第 48 页｜Load/Run-time Interpositioning——LD_PRELOAD 与运行示例

![第48页LD_PRELOAD命令](Attachments/lec13-linking/page-48.png)

> 构建共享库 mymalloc.so。
>
> 单独构建 int.c。
>
> 通过 LD_PRELOAD 指定优先装载的共享库。
>
> 动态符号查找因此先找到包装函数。

下面完整条件段用于本讲的单线程 int.c。可与第 42、44 页的条件段放在同一个 mymalloc.c 中。日志只使用栈内数组和 write，整数与地址由小型格式化函数写入数组。

~~~c
#ifdef RUNTIME
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <inttypes.h>
#include <limits.h>
#include <stddef.h>
#include <stdint.h>
#include <unistd.h>

static void *(*next_malloc)(size_t);
static void (*next_free)(void *);

static char *append_text(char *out, const char *text)
{
    while (*text != '\0')
        *out++ = *text++;
    return out;
}

static char *append_number(char *out, uintmax_t value, unsigned base)
{
    const char digits[] = "0123456789abcdef";
    char reversed[sizeof(uintmax_t) * CHAR_BIT];
    size_t count = 0;

    do {
        reversed[count++] = digits[value % base];
        value /= base;
    } while (value != 0);

    while (count > 0)
        *out++ = reversed[--count];
    return out;
}

static void trace_event(int allocation, size_t size, void *ptr)
{
    int saved_errno = errno;
    char buffer[128];
    char *out = append_text(buffer, allocation ? "malloc(" : "free(");

    if (allocation) {
        out = append_number(out, (uintmax_t)size, 10);
        out = append_text(out, ") = ");
    }
    out = append_text(out, "0x");
    out = append_number(out, (uintmax_t)(uintptr_t)ptr, 16);
    if (!allocation)
        *out++ = ')';
    *out++ = '\n';

    ssize_t result = write(STDERR_FILENO, buffer, (size_t)(out - buffer));
    (void)result;
    errno = saved_errno;
}

static void resolution_failed(void)
{
    const char message[] = "interposer symbol lookup failed\n";
    ssize_t result = write(STDERR_FILENO, message, sizeof message - 1);
    (void)result;
    _exit(127);
}

void *malloc(size_t size)
{
    int saved_errno = errno;
    if (next_malloc == NULL) {
        dlerror();
        next_malloc = (void *(*)(size_t))dlsym(RTLD_NEXT, "malloc");
        if (dlerror() != NULL || next_malloc == NULL)
            resolution_failed();
    }
    errno = saved_errno;
    void *ptr = next_malloc(size);
    trace_event(1, size, ptr);
    return ptr;
}

void free(void *ptr)
{
    if (ptr == NULL)
        return;

    int saved_errno = errno;
    if (next_free == NULL) {
        dlerror();
        next_free = (void (*)(void *))dlsym(RTLD_NEXT, "free");
        if (dlerror() != NULL || next_free == NULL)
            resolution_failed();
    }
    trace_event(0, 0, ptr);
    errno = saved_errno;
    next_free(ptr);
}
#endif
~~~

~~~sh
gcc -std=gnu11 -O0 -Wall -Wextra -DRUNTIME -shared -fPIC -o mymalloc.so mymalloc.c -ldl
gcc -std=gnu11 -O0 -Wall -Wextra -fno-builtin -o intr int.c
LD_PRELOAD=./mymalloc.so ./intr
~~~

可观察到 malloc(32) 与对应 free 的日志。运行时包装对进程中的动态调用生效，因而完整程序还可能产生来自运行库的其他记录。

LD_PRELOAD 在这里仅对指定的这一进程设置。函数指针保存后继实现地址，使包装可以增加观测并继续调用原功能。

这份整理版验证范围为本讲单线程示例，首次 dlsym 解析与函数指针初始化按该范围使用。

## 第 49 页｜Interpositioning Recap——三种插桩的对照

> 编译期，malloc/free 调用通过宏展开变成 mymalloc/myfree。
>
> 链接期，利用特殊符号解析规则，把 malloc 转到 __wrap_malloc，把 __real_malloc 转到 malloc。
>
> 装载／运行期，导出同名包装，通过动态查找取得后继实现，再经函数指针调用。

| 方法 | 改变调用目标的阶段 | 本讲包装入口 | 需要的材料 |
|---|---|---|---|
| 编译期 | 预处理与重新编译调用方 | mymalloc、myfree | 源文件、替换头文件与包装实现 |
| 链接期 | 构建可执行文件的符号解析 | __wrap_malloc、__wrap_free | 调用方目标文件、包装目标文件与 --wrap 选项 |
| 装载／运行期 | 动态链接器符号查找 | 同名 malloc、free | 动态链接程序、包装共享库与 LD_PRELOAD |

三种方法都在函数入口增加观测，并保留转发到实际实现的路径。其可作用的调用范围分别取决于宏展开、链接引用和动态符号可见性。

