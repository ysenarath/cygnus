""" Python PyPi Setup Configurations """

import setuptools

with open("README.md") as fh:
    long_description = fh.read().strip()

with open('packages.txt') as fh:
    requirements = fh.read().strip().split('\n')

setuptools.setup(
    name="cygnus",
    version="0.0.1",
    author="Yasas Senarath",
    author_email="ysenarath.93@gmail.com",
    description="An Intelligent Agents Framework",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/ysenarath/cygnus",
    packages=setuptools.find_packages(),
    install_requires=requirements,
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.6',
    include_package_data=True,
)

